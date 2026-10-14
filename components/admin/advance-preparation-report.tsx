"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  ClipboardList,
  FileSpreadsheet,
  Loader2,
  MapPin,
  Phone,
  Printer,
  RotateCcw,
  Route as RouteIcon,
  Trophy,
  Users,
  XCircle,
} from "lucide-react"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Input, SearchInput, Select } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { ProgressBar, ProgressRing, toneForPct } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { StatTile } from "@/components/ui/stat-card"
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import {
  COLLECTION_TYPES,
  PAY_STATUS_LABELS,
  filterBase,
  formatPeriod,
  monthRange,
  shiftMonth,
  summarise,
  type AdvanceReport,
  type AdvanceRow,
  type CollectionTypeValue,
  type PayStatus,
  type PrizeFilter,
} from "@/lib/advance-preparation"
import { UNASSIGNED } from "@/lib/denomination"
import { inr, inrCompact } from "@/lib/format"
import { cn } from "@/lib/utils"

export type AdvanceRouteOption = {
  id: number
  code: string
  name: string
  branch: string
  areas: string[]
  executives: string[]
  subscribers: number
}

const STATUS_TONE: Record<PayStatus, BadgeTone> = {
  paid: "success",
  part_paid: "warning",
  not_paid: "danger",
  no_due: "neutral",
}

const STATUS_ICON: Record<PayStatus, React.ReactNode> = {
  paid: <CheckCircle2 className="h-3 w-3" />,
  part_paid: <CircleDashed className="h-3 w-3" />,
  not_paid: <XCircle className="h-3 w-3" />,
  no_due: null,
}

const NO_ROWS: AdvanceRow[] = []

function formatDue(day: string | null) {
  if (!day) return "—"
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
}

function monthLabel(from: string) {
  const [y, m] = from.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
}

export default function AdvancePreparationReport({
  branches,
  routes,
  today,
  company,
}: {
  branches: string[]
  routes: AdvanceRouteOption[]
  today: string
  company: { name: string; shortName: string }
}) {
  const initial = monthRange(today)

  const [branch, setBranch] = useState(branches.length === 1 ? branches[0] : "")
  const [route, setRoute] = useState("")
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)

  const [prize, setPrize] = useState<PrizeFilter>("")
  const [type, setType] = useState<CollectionTypeValue | "">("")
  const [status, setStatus] = useState<PayStatus | "">("")
  const [query, setQuery] = useState("")

  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(20)

  const [report, setReport] = useState<AdvanceReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const validPeriod = Boolean(from && to && from <= to)

  const params = useMemo(() => {
    const p = new URLSearchParams({ from, to })
    if (branch) p.set("branch", branch)
    if (route) p.set("route", route)
    return p.toString()
  }, [from, to, branch, route])

  const load = useCallback(async () => {
    if (!route || !validPeriod) return
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/reports/advance-preparation?${params}`)
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? "Could not load the report.")
      }
      setReport((await response.json()) as AdvanceReport)
      setPage(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the report.")
    } finally {
      setLoading(false)
    }
  }, [params, route, validPeriod])

  useEffect(() => {
    void load()
  }, [load])

  const routeOptions = useMemo(
    () => (branch ? routes.filter((r) => r.branch === branch) : routes),
    [routes, branch]
  )
  const selected = routes.find((r) => String(r.id) === route)

  const rows = report?.rows ?? NO_ROWS
  // The status cards summarise everything but the status filter, so clicking
  // one does not collapse the others to zero.
  const base = useMemo(() => filterBase(rows, { prize, type, q: query }), [rows, prize, type, query])
  const visible = useMemo(
    () => (status ? base.filter((r) => r.status === status) : base),
    [base, status]
  )
  const s = useMemo(() => summarise(base), [base])

  const totalPages = Math.max(1, Math.ceil(visible.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const pageRows = visible.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  const hasFilters = Boolean(prize || type || status || query)
  const estimated = rows.some((r) => r.estimated)
  const isMonth = monthRange(from).from === from && monthRange(from).to === to

  const routeLabel = selected
    ? `${selected.code} · ${selected.name}`
    : route === UNASSIGNED
      ? "Unassigned seats"
      : "All routes"

  function resetFilters() {
    setPrize("")
    setType("")
    setStatus("")
    setQuery("")
    setPage(1)
  }

  function moveMonth(delta: number) {
    const next = shiftMonth(from, delta)
    setFrom(next.from)
    setTo(next.to)
  }

  function exportQuery() {
    const p = new URLSearchParams(params)
    if (prize) p.set("prize", prize)
    if (type) p.set("type", type)
    if (status) p.set("status", status)
    if (query.trim()) p.set("q", query.trim())
    return p.toString()
  }

  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="reveal flex flex-wrap items-end justify-between gap-3"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Route collection sheet</h2>
            <p className="text-sm text-muted-foreground">
              Each subscriber on a route and what they owe for the period — the
              executive&apos;s sheet for the round.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!report || loading || visible.length === 0}
            onClick={() =>
              printSheet({
                company,
                rows: visible,
                summary: summarise(visible),
                period: formatPeriod(from, to),
                branch: branch || "All branches",
                route: routeLabel,
                executives: selected?.executives ?? [],
              })
            }
          >
            <Printer className="h-3.5 w-3.5" />
            Print / PDF
          </Button>
          <Button
            size="sm"
            disabled={!report || loading || visible.length === 0}
            onClick={() => {
              window.location.href = `/api/reports/advance-preparation/export?${exportQuery()}`
            }}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Scope: branch, route, period */}
      <Card className="reveal p-4" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="grid gap-3 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto]">
          <FilterField label="Branch">
            <Select
              value={branch}
              onChange={(e) => {
                setBranch(e.target.value)
                setRoute("")
                setReport(null)
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
          </FilterField>

          <FilterField label="Route">
            <Select
              value={route}
              onChange={(e) => {
                setRoute(e.target.value)
                setReport(null)
                resetFilters()
              }}
            >
              <option value="">Select a route…</option>
              {routeOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} · {r.name}
                  {branch ? "" : ` (${r.branch})`} — {r.subscribers} subscribers
                </option>
              ))}
              <option value={UNASSIGNED}>Seats without a route</option>
            </Select>
          </FilterField>

          <FilterField label="Period">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => moveMonth(-1)}>
                <ChevronLeft />
              </Button>
              <Input
                type="date"
                value={from}
                max={to}
                onChange={(e) => e.target.value && setFrom(e.target.value)}
                className="tnum w-[150px]"
                aria-label="From date"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={to}
                min={from}
                onChange={(e) => e.target.value && setTo(e.target.value)}
                className="tnum w-[150px]"
                aria-label="To date"
              />
              <Button variant="outline" size="icon" aria-label="Next month" onClick={() => moveMonth(1)}>
                <ChevronRight />
              </Button>
            </div>
          </FilterField>
        </div>

        {!validPeriod && (
          <p className="mt-2 text-xs font-medium text-danger">The from date must be on or before the to date.</p>
        )}
      </Card>

      {!route ? (
        <RoutePicker routes={routeOptions} onPick={(id) => setRoute(String(id))} />
      ) : (
        <>
          {/* Context */}
          <div
            className="reveal flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-3 text-xs text-muted-foreground"
            style={{ "--i": 2 } as React.CSSProperties}
          >
            <button
              type="button"
              onClick={() => {
                setRoute("")
                setReport(null)
              }}
              className="press flex items-center gap-1 font-medium text-brand hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All routes
            </button>
            <span className="flex items-center gap-1.5">
              <RouteIcon className="h-3.5 w-3.5" />
              <span className="font-semibold text-foreground">{routeLabel}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarRange className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">
                {isMonth ? monthLabel(from) : formatPeriod(from, to)}
              </span>
            </span>
            {selected && (
              <span>
                Branch: <span className="font-medium text-foreground">{selected.branch}</span>
              </span>
            )}
            {selected?.executives.length ? (
              <span>
                Executive:{" "}
                <span className="font-medium text-foreground">{selected.executives.join(", ")}</span>
              </span>
            ) : null}
          </div>

          {error && (
            <div className="animate-scale-in flex items-center justify-between gap-3 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-soft-foreground">
              {error}
              <Button variant="outline" size="xs" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          )}

          {/* KPIs + efficiency */}
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <StatTile index={3} label="Subscribers" value={s.subscribers} loading={loading} />
              <StatTile index={4} label="Due this period" value={s.due} format={inr} tone="brand" loading={loading} />
              <StatTile index={5} label="Collected" value={s.paid} format={inr} tone="success" loading={loading} />
              <StatTile index={6} label="Balance to collect" value={s.balance} format={inr} tone="warning" loading={loading} />
              <StatTile
                index={7}
                label="Earlier arrears"
                value={s.arrears}
                format={inr}
                tone="danger"
                loading={loading}
              />
            </div>
            <Card
              className="reveal flex items-center gap-4 px-5 py-3"
              style={{ "--i": 8 } as React.CSSProperties}
            >
              {loading ? (
                <Skeleton className="h-[72px] w-[72px] rounded-full" />
              ) : (
                <ProgressRing
                  pct={s.efficiency}
                  tone={toneForPct(s.efficiency)}
                  size={72}
                  stroke={7}
                />
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Efficiency
                </p>
                <p className="tnum text-sm text-foreground">
                  {inrCompact(s.paid)} of {inrCompact(s.due)}
                </p>
                <p className="text-xs text-muted-foreground">collected against due</p>
              </div>
            </Card>
          </div>

          {/* Payment status */}
          <div className="grid gap-3 sm:grid-cols-3">
            <StatusCard
              index={9}
              tone="success"
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Paid"
              count={s.paidCount}
              of={s.withDue}
              active={status === "paid"}
              loading={loading}
              onClick={() => setStatus(status === "paid" ? "" : "paid")}
            />
            <StatusCard
              index={10}
              tone="warning"
              icon={<CircleDashed className="h-4 w-4" />}
              label="Part paid"
              count={s.partCount}
              of={s.withDue}
              active={status === "part_paid"}
              loading={loading}
              onClick={() => setStatus(status === "part_paid" ? "" : "part_paid")}
            />
            <StatusCard
              index={11}
              tone="danger"
              icon={<XCircle className="h-4 w-4" />}
              label="Not paid"
              count={s.notPaidCount}
              of={s.withDue}
              active={status === "not_paid"}
              loading={loading}
              onClick={() => setStatus(status === "not_paid" ? "" : "not_paid")}
            />
          </div>

          {/* Subscriber sheet */}
          <Card className="reveal overflow-hidden" style={{ "--i": 12 } as React.CSSProperties}>
            <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div>
                <CardTitle>
                  Subscribers
                  <span className="tnum ml-2 text-xs font-normal text-muted-foreground">
                    {visible.length === rows.length
                      ? `${rows.length}`
                      : `${visible.length} of ${rows.length}`}
                  </span>
                </CardTitle>
                <CardDescription>
                  {s.noDueCount > 0
                    ? `${s.noDueCount} with nothing falling due in this period`
                    : "In collection order: group, then ticket"}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                <Select
                  value={prize}
                  onChange={(e) => {
                    setPrize(e.target.value as PrizeFilter)
                    setPage(1)
                  }}
                  wrapperClassName="w-[140px]"
                  aria-label="Customer list"
                >
                  <option value="">All customers</option>
                  <option value="non_prized">Non-prized</option>
                  <option value="prized">Prized</option>
                </Select>
                <Select
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value as CollectionTypeValue | "")
                    setPage(1)
                  }}
                  wrapperClassName="w-[130px]"
                  aria-label="Collection mode"
                  className="capitalize"
                >
                  <option value="">All modes</option>
                  {COLLECTION_TYPES.map((t) => (
                    <option key={t} value={t} className="capitalize">
                      {t}
                    </option>
                  ))}
                </Select>
                <Select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as PayStatus | "")
                    setPage(1)
                  }}
                  wrapperClassName="w-[130px]"
                  aria-label="Paid status"
                >
                  <option value="">All statuses</option>
                  {(Object.keys(PAY_STATUS_LABELS) as PayStatus[]).map((k) => (
                    <option key={k} value={k}>
                      {PAY_STATUS_LABELS[k]}
                    </option>
                  ))}
                </Select>
                <SearchInput
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Name, mobile, area…"
                  className="w-full sm:w-56"
                />
                {hasFilters && (
                  <Button variant="destructive-soft" size="sm" onClick={resetFilters} className="animate-scale-in">
                    Clear
                  </Button>
                )}
                <Button variant="ghost" size="icon-sm" aria-label="Refresh" onClick={() => void load()} disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                </Button>
              </div>
            </CardHeader>

            {loading && !report ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title={rows.length ? "No subscribers match" : "No subscribers on this route"}
                description={
                  rows.length
                    ? "Try relaxing the filters."
                    : "Seat members on this route from the group's ticket board."
                }
                action={
                  hasFilters ? (
                    <Button variant="outline" size="sm" onClick={resetFilters}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <TableWrap className={cn(loading && "opacity-60 transition-opacity")}>
                  <Table>
                    <THead>
                      <tr>
                        <TH className="w-12">#</TH>
                        <TH>Subscriber</TH>
                        <TH>Area</TH>
                        <TH>Group / Ticket</TH>
                        <TH>Due date</TH>
                        <TH className="text-right">Instalment</TH>
                        <TH className="text-right">Paid</TH>
                        <TH className="text-right">Arrears</TH>
                        <TH>Status</TH>
                        <TH>Staff</TH>
                      </tr>
                    </THead>
                    <TBody key={`${params}-${currentPage}-${status}-${prize}-${type}-${query}`}>
                      {pageRows.map((r, i) => (
                        <TR key={r.ticketId} index={Math.min(i, 14)}>
                          <TD className="tnum text-xs">{(currentPage - 1) * rowsPerPage + i + 1}</TD>
                          <TD>
                            <p className="flex items-center gap-1.5 font-medium text-foreground">
                              {r.name}
                              {r.isPrized && (
                                <Trophy className="h-3.5 w-3.5 text-warning" aria-label="Prized" />
                              )}
                            </p>
                            <p className="tnum flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{r.accountNo}</span>
                              {r.mobile && (
                                <a href={`tel:${r.mobile}`} className="flex items-center gap-1 text-brand hover:underline">
                                  <Phone className="h-3 w-3" />
                                  {r.mobile}
                                </a>
                              )}
                            </p>
                          </TD>
                          <TD className="text-xs">{r.area || "—"}</TD>
                          <TD className="whitespace-nowrap">
                            <p className="text-sm font-semibold text-foreground">{r.group}</p>
                            <p className="flex items-center gap-1.5 text-xs">
                              <span className="tnum rounded border border-border px-1.5 py-px text-2xs font-medium">
                                T-{r.ticketNo}
                              </span>
                              <span className="tnum text-muted-foreground">{inrCompact(r.chitValue)}</span>
                              {r.collectionType !== "monthly" && (
                                <span className="text-2xs capitalize text-muted-foreground">· {r.collectionType}</span>
                              )}
                            </p>
                          </TD>
                          <TD className="tnum whitespace-nowrap text-xs">{formatDue(r.dueDate)}</TD>
                          <TD className="whitespace-nowrap text-right">
                            <span className="tnum block font-semibold text-foreground">
                              {r.due ? inr(r.due) : "—"}
                              {r.estimated && r.due > 0 && (
                                <span className="ml-0.5 align-super text-2xs text-muted-foreground" title="Worked out from the group schedule">
                                  *
                                </span>
                              )}
                            </span>
                            {r.installmentNo && (
                              <span className="tnum block text-xs text-muted-foreground">Inst. {r.installmentNo}</span>
                            )}
                          </TD>
                          <TD className="whitespace-nowrap text-right">
                            <span className={cn("tnum block font-medium", r.paid ? "text-success-soft-foreground" : "text-muted-foreground/60")}>
                              {r.paid ? inr(r.paid) : "—"}
                            </span>
                            {r.due > r.paid && r.paid > 0 && (
                              <span className="tnum block text-xs text-muted-foreground">
                                {inr(r.due - r.paid)} left
                              </span>
                            )}
                          </TD>
                          <TD className="whitespace-nowrap text-right">
                            {r.arrearsAmount ? (
                              <>
                                <span className="tnum block font-semibold text-danger-soft-foreground">
                                  {inr(r.arrearsAmount)}
                                </span>
                                <span className="tnum block text-xs text-muted-foreground">
                                  {r.arrearsCount} inst.
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground/60">—</span>
                            )}
                          </TD>
                          <TD>
                            <Badge tone={STATUS_TONE[r.status]}>
                              {STATUS_ICON[r.status]}
                              {PAY_STATUS_LABELS[r.status]}
                            </Badge>
                          </TD>
                          <TD className="whitespace-nowrap text-xs">{r.staff || "—"}</TD>
                        </TR>
                      ))}
                    </TBody>
                    <tfoot className="border-t border-border bg-surface-2 text-sm">
                      <tr>
                        <td className="px-4 py-3 font-semibold text-foreground" colSpan={5}>
                          Total · {visible.length} subscribers
                        </td>
                        <td className="tnum px-4 py-3 text-right font-bold text-foreground">
                          {inr(visible.reduce((t, r) => t + r.due, 0))}
                        </td>
                        <td className="tnum px-4 py-3 text-right font-bold text-success-soft-foreground">
                          {inr(visible.reduce((t, r) => t + r.paid, 0))}
                        </td>
                        <td className="tnum px-4 py-3 text-right font-bold text-danger-soft-foreground">
                          {inr(visible.reduce((t, r) => t + (r.arrearsAmount ?? 0), 0))}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </Table>
                </TableWrap>
                <Pagination
                  page={currentPage}
                  totalPages={totalPages}
                  totalRows={visible.length}
                  rowsPerPage={rowsPerPage}
                  onPageChange={setPage}
                  onRowsChange={(n) => {
                    setRowsPerPage(n)
                    setPage(1)
                  }}
                />
              </>
            )}
          </Card>

          {estimated && (
            <p className="flex items-start gap-1.5 px-1 text-xs text-muted-foreground">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-warning" />
              * Instalments marked with an asterisk are worked out from the group schedule and
              auction dividends, because these seats have no dues ledger yet. Earlier arrears are
              not available for them.
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

const STATUS_STYLE = {
  success: { ring: "ring-success/50", chip: "bg-success-soft text-success-soft-foreground", value: "text-success-soft-foreground" },
  warning: { ring: "ring-warning/50", chip: "bg-warning-soft text-warning-soft-foreground", value: "text-warning-soft-foreground" },
  danger: { ring: "ring-danger/50", chip: "bg-danger-soft text-danger-soft-foreground", value: "text-danger-soft-foreground" },
} as const

function StatusCard({
  tone,
  icon,
  label,
  count,
  of,
  active,
  loading,
  index,
  onClick,
}: {
  tone: keyof typeof STATUS_STYLE
  icon: React.ReactNode
  label: string
  count: number
  of: number
  active: boolean
  loading: boolean
  index: number
  onClick: () => void
}) {
  const pct = of ? (count / of) * 100 : 0
  const style = STATUS_STYLE[tone]
  return (
    <Card
      interactive
      className={cn("reveal p-0 transition-shadow", active && `ring-2 ${style.ring}`)}
      style={{ "--i": index } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        title={active ? "Show every status" : `Show only ${label.toLowerCase()}`}
        className="w-full p-4 text-left"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", style.chip)}>{icon}</span>
            {label}
          </span>
          <span className="tnum text-xs text-muted-foreground">{Math.round(pct * 10) / 10}%</span>
        </div>
        <div className="mt-3 flex items-baseline gap-1.5">
          {loading ? (
            <Skeleton className="h-8 w-14" />
          ) : (
            <span className={cn("tnum text-3xl font-bold tracking-tight", style.value)}>{count}</span>
          )}
          <span className="tnum text-xs text-muted-foreground">of {of}</span>
        </div>
        <ProgressBar pct={pct} tone={tone} className="mt-3 h-1.5" />
      </button>
    </Card>
  )
}

function RoutePicker({
  routes,
  onPick,
}: {
  routes: AdvanceRouteOption[]
  onPick: (id: number) => void
}) {
  if (routes.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<RouteIcon className="h-5 w-5" />}
          title="No routes in this branch"
          description="Routes are set up under Settings → Routes."
        />
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-medium text-muted-foreground">
        Choose a route to prepare its collection sheet.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {routes.map((r, i) => (
          <Card
            key={r.id}
            interactive
            className="reveal p-0"
            style={{ "--i": Math.min(i + 2, 14) } as React.CSSProperties}
          >
            <button type="button" onClick={() => onPick(r.id)} className="group w-full p-4 text-left">
              <div className="flex items-start gap-3">
                <span className="tnum flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft px-2 text-xs font-bold text-brand-soft-foreground">
                  {r.code}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.branch}
                    {r.executives.length > 0 && ` · ${r.executives.join(", ")}`}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1 truncate text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{r.areas.length ? r.areas.join(", ") : "No areas listed"}</span>
                </span>
                <Badge tone={r.subscribers ? "brand" : "neutral"}>
                  <Users className="h-3 w-3" />
                  {r.subscribers}
                </Badge>
              </div>
            </button>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Print
// ---------------------------------------------------------------------------

const esc = (value: string | number) =>
  String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Opens an A4 landscape sheet the executive can carry on the round. */
function printSheet({
  company,
  rows,
  summary,
  period,
  branch,
  route,
  executives,
}: {
  company: { name: string }
  rows: AdvanceRow[]
  summary: ReturnType<typeof summarise>
  period: string
  branch: string
  route: string
  executives: string[]
}) {
  const win = window.open("", "_blank", "width=1100,height=800")
  if (!win) return

  const body = rows
    .map(
      (r, i) => `<tr>
  <td>${i + 1}</td>
  <td><b>${esc(r.name)}</b>${r.isPrized ? " ★" : ""}<br><span class="m">${esc(r.accountNo)} · ${esc(r.mobile)}</span></td>
  <td>${esc(r.area)}</td>
  <td><b>${esc(r.group)}</b> / ${r.ticketNo}<br><span class="m">${inr(r.chitValue)}</span></td>
  <td>${esc(formatDue(r.dueDate))}</td>
  <td class="r">${r.installmentNo ?? "—"}</td>
  <td class="r">${r.due ? inr(r.due) : "—"}${r.estimated && r.due ? "*" : ""}</td>
  <td class="r">${r.paid ? inr(r.paid) : ""}</td>
  <td class="r">${r.arrearsAmount ? inr(r.arrearsAmount) : ""}</td>
  <td>${PAY_STATUS_LABELS[r.status]}</td>
  <td class="w"></td>
</tr>`
    )
    .join("")

  win.document.open()
  win.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>Route Collection Sheet – ${esc(route)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font: 10.5px/1.4 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #111827; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111827; padding-bottom: 6px; margin-bottom: 8px; }
  h1 { font-size: 15px; margin: 0; }
  .m { color: #6b7280; font-size: 9.5px; }
  .meta { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-bottom: 8px; }
  .meta b { color: #111827; }
  .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-bottom: 10px; }
  .kpis div { border: 1px solid #e5e7eb; border-radius: 6px; padding: 5px 8px; }
  .kpis b { display: block; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 4px 5px; border: 1px solid #e5e7eb; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
  .r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .w { width: 70px; }
  tfoot td { font-weight: 700; background: #f9fafb; }
  tr { page-break-inside: avoid; }
  .sign { display: flex; justify-content: space-between; margin-top: 40px; }
  .sign div { border-top: 1px solid #111827; padding-top: 4px; width: 180px; text-align: center; }
</style></head><body>
<header>
  <div><h1>${esc(company.name)}</h1><div class="m">Route Collection Sheet</div></div>
  <div class="m" style="text-align:right">Printed ${esc(new Date().toLocaleString("en-IN"))}</div>
</header>
<div class="meta">
  <span>Period: <b>${esc(period)}</b></span>
  <span>Branch: <b>${esc(branch)}</b></span>
  <span>Route: <b>${esc(route)}</b></span>
  ${executives.length ? `<span>Executive: <b>${esc(executives.join(", "))}</b></span>` : ""}
</div>
<div class="kpis">
  <div>Subscribers<b>${summary.subscribers}</b></div>
  <div>Due<b>${inr(summary.due)}</b></div>
  <div>Collected<b>${inr(summary.paid)}</b></div>
  <div>Balance<b>${inr(summary.balance)}</b></div>
  <div>Paid / Part / Not<b>${summary.paidCount} / ${summary.partCount} / ${summary.notPaidCount}</b></div>
  <div>Efficiency<b>${summary.efficiency.toFixed(1)}%</b></div>
</div>
<table>
<thead><tr><th>#</th><th>Subscriber</th><th>Area</th><th>Group / Ticket</th><th>Due date</th><th class="r">Inst.</th><th class="r">Due</th><th class="r">Paid</th><th class="r">Arrears</th><th>Status</th><th>Collected</th></tr></thead>
<tbody>${body}</tbody>
<tfoot><tr><td colspan="6">Total · ${rows.length} subscribers</td><td class="r">${inr(summary.due)}</td><td class="r">${inr(rows.reduce((t, r) => t + r.paid, 0))}</td><td class="r">${inr(summary.arrears)}</td><td colspan="2"></td></tr></tfoot>
</table>
${rows.some((r) => r.estimated) ? `<p class="m">* Worked out from the group schedule; no dues ledger for this seat yet.</p>` : ""}
<div class="sign"><div>Collection Executive</div><div>Supervisor</div><div>Branch Manager</div></div>
<script>window.onload = () => { window.focus(); window.print(); }</script>
</body></html>`)
  win.document.close()
}
