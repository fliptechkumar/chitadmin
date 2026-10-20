"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  FileSpreadsheet,
  Landmark,
  Loader2,
  Printer,
  ReceiptText,
  RotateCcw,
  Scale,
  Wallet,
} from "lucide-react"

import { DenominationBreakdown, VarianceText } from "./denomination-tally"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Input, SearchInput, Select } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/ui/stat-card"
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import {
  DENOMINATIONS,
  UNASSIGNED,
  denominationTotal,
  formatReportDay,
  scopeKeyFor,
  shiftIsoDay,
  sumCounts,
  varianceOf,
  type DenominationReport as Report,
  type DenominationRow,
  type RouteSummary,
} from "@/lib/denomination"
import { inr } from "@/lib/format"
import { cn } from "@/lib/utils"

export type RouteOption = { id: number; code: string; name: string; branch: string }

type Mode = DenominationRow["mode"]

const MODES: { mode: Mode; label: string; icon: React.ReactNode; bar: string }[] = [
  { mode: "cash", label: "Cash", icon: <Banknote className="h-4 w-4" />, bar: "bg-success" },
  { mode: "online", label: "Online", icon: <CreditCard className="h-4 w-4" />, bar: "bg-brand" },
  { mode: "cheque", label: "Cheque", icon: <Landmark className="h-4 w-4" />, bar: "bg-violet" },
]

const NO_ROWS: DenominationRow[] = []
const NO_ROUTES: RouteSummary[] = []

const MODE_TONE = { cash: "success", online: "brand", cheque: "violet" } as const

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
}

function routeTitle(r: Pick<RouteSummary, "code" | "name">) {
  return r.code === "—" ? r.name : `${r.code} · ${r.name}`
}

export default function DenominationReport({
  branches,
  routes,
  initialDate,
  company,
}: {
  branches: string[]
  routes: RouteOption[]
  initialDate: string
  company: { name: string; address: string }
}) {
  const [date, setDate] = useState(initialDate)
  const [branch, setBranch] = useState(branches.length === 1 ? branches[0] : "")
  const [route, setRoute] = useState("")
  const [query, setQuery] = useState("")
  const [modeFilter, setModeFilter] = useState<Mode | "">("")

  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const params = useMemo(() => {
    const p = new URLSearchParams({ date })
    if (branch) p.set("branch", branch)
    if (route) p.set("route", route)
    return p.toString()
  }, [date, branch, route])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/reports/denomination?${params}`)
      if (!response.ok) throw new Error(String(response.status))
      setReport((await response.json()) as Report)
    } catch {
      setError("Could not load the report. Check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    void load()
  }, [load])

  const routeOptions = useMemo(
    () => (branch ? routes.filter((r) => r.branch === branch) : routes),
    [routes, branch]
  )

  const rows = report?.rows ?? NO_ROWS
  const summaries = report?.routes ?? NO_ROUTES

  const totals = useMemo(() => {
    const byMode = Object.fromEntries(
      MODES.map(({ mode }) => {
        const list = rows.filter((r) => r.mode === mode)
        return [mode, { amount: list.reduce((s, r) => s + r.total, 0), count: list.length }]
      })
    ) as Record<Mode, { amount: number; count: number }>

    const tallied = summaries.filter((r) => r.tally)
    const counted = tallied.reduce((s, r) => s + (r.tally?.total ?? 0), 0)
    const cashOfTallied = tallied.reduce((s, r) => s + r.cash, 0)
    const withCash = summaries.filter((r) => r.cash > 0 || r.tally)

    return {
      byMode,
      total: rows.reduce((s, r) => s + r.total, 0),
      counted,
      variance: counted - cashOfTallied,
      talliedCount: tallied.length,
      pendingCount: withCash.filter((r) => !r.tally).length,
      routesWithCash: withCash.length,
      counts: sumCounts(tallied.map((r) => r.tally?.counts ?? {})),
    }
  }, [rows, summaries])

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (!modeFilter || r.mode === modeFilter) &&
        (!q ||
          r.customerName.toLowerCase().includes(q) ||
          r.receiptNo.toLowerCase().includes(q) ||
          r.group.toLowerCase().includes(q) ||
          r.collectedBy.toLowerCase().includes(q))
    )
  }, [rows, query, modeFilter])

  const routeCode = useMemo(
    () => new Map(summaries.map((s) => [s.key, s.code])),
    [summaries]
  )

  /** The one route in view, when the filters narrow it to a single cash bag. */
  const single = summaries.length === 1 ? summaries[0] : null
  const selectedRoute = routes.find((r) => String(r.id) === route)
  const hasFilters = Boolean(route || (branch && branches.length > 1) || query || modeFilter)

  function reset() {
    setBranch(branches.length === 1 ? branches[0] : "")
    setRoute("")
    setQuery("")
    setModeFilter("")
  }

  function exportExcel() {
    window.location.href = `/api/reports/denomination/export?${params}`
  }

  function print() {
    if (!report) return
    printReport({
      company,
      report,
      branchLabel: branch || "All branches",
      routeLabel: selectedRoute
        ? `${selectedRoute.code} · ${selectedRoute.name}`
        : route === UNASSIGNED
          ? "Unassigned receipts"
          : "All routes",
      totals,
    })
  }

  const executives = single?.executives.length ? single.executives.join(", ") : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="reveal flex flex-wrap items-end justify-between gap-3"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Denomination report</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Reconcile the day&apos;s receipts against the cash handed in, note by note.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={print} disabled={!report || loading}>
            <Printer className="h-3.5 w-3.5" />
            Print / PDF
          </Button>
          <Button size="sm" onClick={exportExcel} disabled={!report || loading}>
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card
        className="reveal flex flex-wrap items-end gap-3 p-3"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <div className="w-full space-y-1 sm:w-auto">
          <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            Collection date
          </label>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous day"
              onClick={() => setDate((d) => shiftIsoDay(d, -1))}
            >
              <ChevronLeft />
            </Button>
            <div className="relative flex-1 sm:w-44 sm:flex-none">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={date}
                max={initialDate}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="tnum pl-9"
                aria-label="Collection date"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next day"
              onClick={() => setDate((d) => shiftIsoDay(d, 1))}
              disabled={date >= initialDate}
            >
              <ChevronRight />
            </Button>
            {date !== initialDate && (
              <Button variant="ghost" size="sm" onClick={() => setDate(initialDate)}>
                Today
              </Button>
            )}
          </div>
        </div>

        <div className="w-full space-y-1 sm:w-44">
          <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            Branch
          </label>
          <Select
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value)
              setRoute("")
            }}
            disabled={branches.length <= 1}
          >
            {branches.length !== 1 && <option value="">All branches</option>}
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-full space-y-1 sm:w-56">
          <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            Route
          </label>
          <Select value={route} onChange={(e) => setRoute(e.target.value)}>
            <option value="">All routes</option>
            {routeOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} · {r.name}
                {branch ? "" : ` (${r.branch})`}
              </option>
            ))}
            <option value={UNASSIGNED}>Unassigned receipts</option>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {hasFilters && (
            <Button variant="destructive-soft" size="sm" onClick={reset} className="animate-scale-in">
              Clear
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </Card>

      {/* Context strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{formatReportDay(date)}</span>
        </span>
        <span>
          Branch: <span className="font-medium text-foreground">{branch || "All branches"}</span>
        </span>
        <span>
          Route:{" "}
          <span className="font-medium text-foreground">
            {selectedRoute
              ? `${selectedRoute.code} · ${selectedRoute.name}`
              : route === UNASSIGNED
                ? "Unassigned receipts"
                : "All routes"}
          </span>
        </span>
        {executives && (
          <span>
            Collection executive: <span className="font-medium text-foreground">{executives}</span>
          </span>
        )}
      </div>

      {error && (
        <div className="animate-scale-in flex items-center justify-between gap-3 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-soft-foreground">
          {error}
          <Button variant="outline" size="xs" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          index={2}
          label="Total collection"
          value={totals.total}
          format={inr}
          icon={<ReceiptText className="h-5 w-5" />}
          tone="brand"
          caption={`${rows.length} receipt${rows.length === 1 ? "" : "s"} across all modes`}
          loading={loading && !report}
        />
        <StatCard
          index={3}
          label="Cash receipts"
          value={totals.byMode.cash.amount}
          format={inr}
          icon={<Wallet className="h-5 w-5" />}
          tone="success"
          caption="Expected in the cash bag"
          loading={loading && !report}
        />
        <StatCard
          index={4}
          label="Total denomination"
          value={totals.counted}
          format={inr}
          icon={<Banknote className="h-5 w-5" />}
          tone="violet"
          caption={
            totals.routesWithCash === 0
              ? "No cash to count"
              : `${totals.talliedCount} of ${totals.routesWithCash} route${totals.routesWithCash === 1 ? "" : "s"} counted`
          }
          loading={loading && !report}
        />
        <StatCard
          index={5}
          label="Variance"
          value={Math.abs(totals.variance)}
          format={(n) => (totals.variance < 0 ? `−${inr(n)}` : inr(n))}
          icon={<Scale className="h-5 w-5" />}
          tone={totals.variance === 0 ? "neutral" : totals.variance < 0 ? "danger" : "warning"}
          caption={
            totals.talliedCount === 0
              ? "Awaiting cash count"
              : totals.variance === 0
                ? "Counted cash matches receipts"
                : totals.variance < 0
                  ? "Cash short of receipts"
                  : "Cash in excess of receipts"
          }
          loading={loading && !report}
        />
      </div>

      {/* Mode split + cash count */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="reveal lg:col-span-2" style={{ "--i": 6 } as React.CSSProperties}>
          <CardHeader>
            <div>
              <CardTitle>Payment mode summary</CardTitle>
              <CardDescription>Share of the day&apos;s collection</CardDescription>
            </div>
          </CardHeader>
          <div className="space-y-4 p-5">
            {/* Stacked share bar */}
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
              {totals.total > 0 &&
                MODES.map(({ mode, bar }) => (
                  <div
                    key={mode}
                    className={cn("h-full transition-[width] duration-700", bar)}
                    style={{ width: `${(totals.byMode[mode].amount / totals.total) * 100}%` }}
                  />
                ))}
            </div>

            <ul className="space-y-1">
              {MODES.map(({ mode, label, icon, bar }) => {
                const m = totals.byMode[mode]
                const share = totals.total ? Math.round((m.amount / totals.total) * 100) : 0
                const active = modeFilter === mode
                return (
                  <li key={mode}>
                    <button
                      type="button"
                      onClick={() => setModeFilter(active ? "" : mode)}
                      className={cn(
                        "press flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted",
                        active && "bg-muted ring-1 ring-border"
                      )}
                      aria-pressed={active}
                      title={`Show only ${label.toLowerCase()} receipts`}
                    >
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", bar)} />
                      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <span className="text-muted-foreground">{icon}</span>
                        {label}
                      </span>
                      <span className="tnum text-xs text-muted-foreground">
                        {m.count} · {share}%
                      </span>
                      <span className="tnum ml-auto text-sm font-semibold text-foreground">
                        {loading && !report ? <Skeleton className="h-4 w-16" /> : inr(m.amount)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="font-medium text-muted-foreground">Total</span>
              <span className="tnum font-bold text-foreground">{inr(totals.total)}</span>
            </div>
          </div>
        </Card>

        <Card className="reveal lg:col-span-3" style={{ "--i": 7 } as React.CSSProperties}>
          <CardHeader>
            <div>
              <CardTitle>Cash denomination</CardTitle>
              <CardDescription>
                {single
                  ? single.tally
                    ? `Counted by ${single.tally.countedBy || "—"} · ${timeOf(single.tally.updatedAt)}`
                    : "Not counted yet · the route counts its cash in the mobile app"
                  : `Combined count of ${totals.talliedCount} route${totals.talliedCount === 1 ? "" : "s"}`}
              </CardDescription>
            </div>
          </CardHeader>
          <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto]">
            {loading && !report ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : (
              <DenominationBreakdown counts={totals.counts} />
            )}

            <div className="flex flex-col gap-2 sm:w-48">
              <div className="rounded-lg bg-surface-2 p-3">
                <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Counted
                </p>
                <p className="tnum text-lg font-bold text-foreground">
                  {inr(denominationTotal(totals.counts))}
                </p>
              </div>
              <div className="rounded-lg bg-surface-2 p-3">
                <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Difference
                </p>
                <p className="tnum text-sm">
                  {totals.talliedCount ? (
                    <VarianceText variance={totals.variance} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </p>
              </div>
              {single?.tally?.remarks && (
                <p className="rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground">
                  {single.tally.remarks}
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Route reconciliation */}
      {!single && summaries.length > 0 && (
        <Card className="reveal overflow-hidden" style={{ "--i": 8 } as React.CSSProperties}>
          <CardHeader>
            <div>
              <CardTitle>Route reconciliation</CardTitle>
              <CardDescription>
                {totals.pendingCount
                  ? `${totals.pendingCount} route${totals.pendingCount === 1 ? "" : "s"} still to be counted`
                  : "Every route with cash has been counted"}
              </CardDescription>
            </div>
          </CardHeader>
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Route</TH>
                  <TH>Executive</TH>
                  <TH className="text-right">Receipts</TH>
                  <TH className="text-right">Cash</TH>
                  <TH className="text-right">Online / Cheque</TH>
                  <TH className="text-right">Counted</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody key={params}>
                {summaries.map((s, i) => {
                  const variance = varianceOf(s)
                  return (
                    <TR key={s.key} index={i}>
                      <TD>
                        <p className="font-medium text-foreground">{routeTitle(s)}</p>
                        <p className="text-xs text-muted-foreground">{s.branch}</p>
                      </TD>
                      <TD className="text-xs">
                        {s.executives.length ? s.executives.join(", ") : "—"}
                      </TD>
                      <TD className="tnum text-right">{s.receipts}</TD>
                      <TD className="tnum text-right font-semibold text-foreground">
                        {inr(s.cash)}
                      </TD>
                      <TD className="tnum text-right">{inr(s.online + s.cheque)}</TD>
                      <TD className="tnum text-right font-semibold text-foreground">
                        {s.tally ? inr(s.tally.total) : <span className="text-muted-foreground/60">—</span>}
                      </TD>
                      <TD>
                        {variance === null ? (
                          s.cash > 0 ? (
                            <Badge tone="warning">
                              <Clock className="h-3 w-3" />
                              Not counted
                            </Badge>
                          ) : (
                            <Badge>No cash</Badge>
                          )
                        ) : variance === 0 ? (
                          <Badge tone="success">
                            <CheckCircle2 className="h-3 w-3" />
                            Tallied
                          </Badge>
                        ) : (
                          <Badge tone={variance < 0 ? "danger" : "warning"}>
                            <AlertTriangle className="h-3 w-3" />
                            {variance < 0 ? "Short" : "Excess"} {inr(Math.abs(variance))}
                          </Badge>
                        )}
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
              <tfoot className="border-t border-border bg-surface-2 text-sm">
                <tr>
                  <td className="px-4 py-3 font-semibold text-foreground" colSpan={2}>
                    Total
                  </td>
                  <td className="tnum px-4 py-3 text-right font-semibold">{rows.length}</td>
                  <td className="tnum px-4 py-3 text-right font-bold text-foreground">
                    {inr(totals.byMode.cash.amount)}
                  </td>
                  <td className="tnum px-4 py-3 text-right font-semibold">
                    {inr(totals.byMode.online.amount + totals.byMode.cheque.amount)}
                  </td>
                  <td className="tnum px-4 py-3 text-right font-bold text-foreground">
                    {inr(totals.counted)}
                  </td>
                  <td className="px-4 py-3" colSpan={2}>
                    {totals.talliedCount > 0 && <VarianceText variance={totals.variance} />}
                  </td>
                </tr>
              </tfoot>
            </Table>
          </TableWrap>
        </Card>
      )}

      {/* Collection details */}
      <Card className="reveal overflow-hidden" style={{ "--i": 9 } as React.CSSProperties}>
        <CardHeader className="flex-wrap">
          <div>
            <CardTitle>
              Collection details
              <span className="tnum ml-2 text-xs font-normal text-muted-foreground">
                {visibleRows.length === rows.length
                  ? `${rows.length} receipts`
                  : `${visibleRows.length} of ${rows.length} receipts`}
              </span>
            </CardTitle>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {modeFilter && (
              <Badge tone={MODE_TONE[modeFilter]} size="md" className="animate-scale-in">
                {modeFilter}
                <button
                  type="button"
                  aria-label="Clear mode filter"
                  className="-mr-1 rounded-full px-1 hover:bg-foreground/10"
                  onClick={() => setModeFilter("")}
                >
                  ×
                </button>
              </Badge>
            )}
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Member, receipt, group or collector…"
              className="w-full sm:w-72"
            />
          </div>
        </CardHeader>

        {loading && !report ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : visibleRows.length === 0 ? (
          <EmptyState
            icon={<ReceiptText className="h-5 w-5" />}
            title={rows.length ? "No receipts match" : "No collections on this day"}
            description={
              rows.length
                ? "Try a different search or payment mode."
                : `Nothing was collected for ${formatReportDay(date)} in this selection. Pick another date or route.`
            }
            action={
              rows.length ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery("")
                    setModeFilter("")
                  }}
                >
                  Clear search
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDate((d) => shiftIsoDay(d, -1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous day
                </Button>
              )
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH className="w-12">#</TH>
                  <TH>Receipt</TH>
                  <TH>Time</TH>
                  <TH>Member</TH>
                  <TH>Chit group</TH>
                  <TH>Route</TH>
                  <TH>Collected by</TH>
                  <TH>Mode</TH>
                  <TH className="text-right">Amount</TH>
                </tr>
              </THead>
              <TBody key={`${params}-${query}-${modeFilter}`}>
                {visibleRows.map((r, i) => (
                  <TR key={r.id} index={Math.min(i, 12)}>
                    <TD className="tnum text-xs">{i + 1}</TD>
                    <TD className="font-mono text-xs">{r.receiptNo}</TD>
                    <TD className="tnum whitespace-nowrap text-xs">{timeOf(r.createdAt)}</TD>
                    <TD className="font-medium text-foreground">{r.customerName}</TD>
                    <TD className="whitespace-nowrap text-xs">
                      {r.group}
                      <span className="block text-muted-foreground">Inst. {r.installment}</span>
                    </TD>
                    <TD className="whitespace-nowrap text-xs">
                      {routeCode.get(scopeKeyFor(r.branch, r.routeId)) ?? "—"}
                      <span className="block text-muted-foreground">{r.branch}</span>
                    </TD>
                    <TD className="whitespace-nowrap text-xs">{r.collectedBy}</TD>
                    <TD>
                      <Badge tone={MODE_TONE[r.mode]}>{r.mode}</Badge>
                    </TD>
                    <TD className="whitespace-nowrap text-right">
                      <span className="tnum block font-semibold text-foreground">
                        {inr(r.total)}
                      </span>
                      {r.penalty > 0 && (
                        <span className="tnum block text-2xs text-muted-foreground">
                          incl. {inr(r.penalty)} penalty
                        </span>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
              <tfoot className="border-t border-border bg-surface-2 text-sm">
                <tr>
                  <td className="px-4 py-3 font-semibold text-foreground" colSpan={8}>
                    Total
                  </td>
                  <td className="tnum px-4 py-3 text-right font-bold text-foreground">
                    {inr(visibleRows.reduce((s, r) => s + r.total, 0))}
                  </td>
                </tr>
              </tfoot>
            </Table>
          </TableWrap>
        )}
      </Card>

    </div>
  )
}

// ---------------------------------------------------------------------------
// Print
// ---------------------------------------------------------------------------

const esc = (value: string | number) =>
  String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/**
 * Opens a print-ready copy of the report in its own window. A standalone
 * document prints cleanly on A4 regardless of the admin chrome, and the
 * browser's "Save as PDF" turns it into the PDF.
 */
function printReport({
  company,
  report,
  branchLabel,
  routeLabel,
  totals,
}: {
  company: { name: string; address: string }
  report: Report
  branchLabel: string
  routeLabel: string
  totals: {
    byMode: Record<Mode, { amount: number; count: number }>
    total: number
    counted: number
    variance: number
    talliedCount: number
    counts: ReturnType<typeof sumCounts>
  }
}) {
  const win = window.open("", "_blank", "width=1000,height=800")
  if (!win) return

  const codeOf = new Map(report.routes.map((r) => [r.key, r.code]))
  const varianceLabel = (v: number | null) =>
    v === null ? "Not counted" : v === 0 ? "Tallied" : `${v < 0 ? "Short" : "Excess"} ${inr(Math.abs(v))}`

  const denomRows = DENOMINATIONS.filter((v) => (totals.counts[`${v}`] ?? 0) > 0)
    .map((v) => {
      const n = totals.counts[`${v}`] ?? 0
      return `<tr><td>₹${v}</td><td class="r">${n}</td><td class="r">${inr(v * n)}</td></tr>`
    })
    .join("")

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Denomination Report – ${esc(report.date)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font: 11px/1.45 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #111827; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111827; padding-bottom: 8px; }
  h1 { font-size: 16px; margin: 0; }
  h2 { font-size: 12px; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: .06em; color: #374151; }
  .muted { color: #6b7280; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 10px; }
  .meta div { border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 8px; }
  .meta b { display: block; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 5px 6px; border-bottom: 1px solid #e5e7eb; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
  .r { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: 700; border-top: 1.5px solid #111827; border-bottom: none; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 48px; }
  .sign div { border-top: 1px solid #111827; padding-top: 4px; text-align: center; }
  tr { page-break-inside: avoid; }
</style></head><body>
<header>
  <div><h1>${esc(company.name)}</h1>${company.address ? `<div class="muted">${esc(company.address)}</div>` : ""}</div>
  <div style="text-align:right"><h1>Denomination Report</h1><div class="muted">Printed ${esc(new Date().toLocaleString("en-IN"))}</div></div>
</header>
<div class="meta">
  <div><span class="muted">Collection date</span><b>${esc(formatReportDay(report.date))}</b></div>
  <div><span class="muted">Branch</span><b>${esc(branchLabel)}</b></div>
  <div><span class="muted">Route</span><b>${esc(routeLabel)}</b></div>
  <div><span class="muted">Receipts</span><b>${report.rows.length}</b></div>
</div>
<div class="cols">
  <div>
    <h2>Payment mode summary</h2>
    <table><thead><tr><th>Mode</th><th class="r">Receipts</th><th class="r">Amount</th></tr></thead><tbody>
    ${MODES.map(({ mode, label }) => `<tr><td>${label}</td><td class="r">${totals.byMode[mode].count}</td><td class="r">${inr(totals.byMode[mode].amount)}</td></tr>`).join("")}
    </tbody><tfoot><tr><td>Total collection</td><td class="r">${report.rows.length}</td><td class="r">${inr(totals.total)}</td></tr></tfoot></table>
  </div>
  <div>
    <h2>Cash denomination</h2>
    <table><thead><tr><th>Value</th><th class="r">Pieces</th><th class="r">Amount</th></tr></thead><tbody>
    ${denomRows || `<tr><td colspan="3" class="muted">Cash not counted</td></tr>`}
    </tbody><tfoot>
      <tr><td colspan="2">Total denomination</td><td class="r">${inr(totals.counted)}</td></tr>
      <tr><td colspan="2">Variance vs cash receipts</td><td class="r">${totals.talliedCount ? esc(varianceLabel(totals.variance)) : "—"}</td></tr>
    </tfoot></table>
  </div>
</div>
${
  report.routes.length > 1
    ? `<h2>Route reconciliation</h2>
<table><thead><tr><th>Route</th><th>Branch</th><th>Executive</th><th class="r">Receipts</th><th class="r">Cash</th><th class="r">Online / Cheque</th><th class="r">Counted</th><th>Status</th></tr></thead><tbody>
${report.routes
  .map(
    (r) =>
      `<tr><td>${esc(routeTitle(r))}</td><td>${esc(r.branch)}</td><td>${esc(r.executives.join(", ") || "—")}</td><td class="r">${r.receipts}</td><td class="r">${inr(r.cash)}</td><td class="r">${inr(r.online + r.cheque)}</td><td class="r">${r.tally ? inr(r.tally.total) : "—"}</td><td>${esc(varianceLabel(varianceOf(r)))}</td></tr>`
  )
  .join("")}
</tbody></table>`
    : ""
}
<h2>Collection details</h2>
<table><thead><tr><th>#</th><th>Receipt</th><th>Time</th><th>Member</th><th>Chit group</th><th>Route</th><th>Collected by</th><th>Mode</th><th class="r">Amount</th></tr></thead><tbody>
${
  report.rows
    .map(
      (r, i) =>
        `<tr><td>${i + 1}</td><td>${esc(r.receiptNo)}</td><td>${esc(timeOf(r.createdAt))}</td><td>${esc(r.customerName)}</td><td>${esc(r.group)} / ${r.installment}</td><td>${esc(codeOf.get(scopeKeyFor(r.branch, r.routeId)) ?? "—")}</td><td>${esc(r.collectedBy)}</td><td>${r.mode.toUpperCase()}</td><td class="r">${inr(r.total)}</td></tr>`
    )
    .join("") || `<tr><td colspan="9" class="muted">No collections on this day.</td></tr>`
}
</tbody><tfoot><tr><td colspan="8">Total</td><td class="r">${inr(totals.total)}</td></tr></tfoot></table>
<div class="sign"><div>Collection Executive</div><div>Cashier</div><div>Branch Manager</div></div>
<script>window.onload = () => { window.focus(); window.print(); }</script>
</body></html>`

  win.document.open()
  win.document.write(html)
  win.document.close()
}
