"use client"

import { useEffect, useState } from "react"
import { Eye, ReceiptText } from "lucide-react"

import ReceiptDialog from "@/components/admin/receipt-dialog"
import { Badge, toneFor } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Combobox } from "@/components/ui/combobox"
import { EmptyState } from "@/components/ui/empty-state"
import { Input, SearchInput, Select } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { StatTile } from "@/components/ui/stat-card"
import {
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table"
import { Toolbar } from "@/components/ui/toolbar"
import type { RegisterFilters, RegisterPage } from "@/lib/collection-register"
import { COLLECTION_MODES } from "@/lib/collection-schema"
import { shiftIsoDay } from "@/lib/denomination"
import { inr, inrCompact } from "@/lib/format"

const COLUMNS = [
  "Receipt no",
  "Customer",
  "Group",
  "Inst.",
  "Amount",
  "Mode",
  "Date",
  "Route",
  "Collected by",
  "",
]

const SEARCH_DELAY_MS = 300

const NO_FILTERS = { mode: "", route: "", group: "", collector: "", from: "", to: "" }

/** Today, yyyy-mm-dd, on the branches' calendar. */
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })

const PERIODS = [
  { value: "today", label: "Today", range: (t: string) => [t, t] },
  {
    value: "yesterday",
    label: "Yesterday",
    range: (t: string) => [shiftIsoDay(t, -1), shiftIsoDay(t, -1)],
  },
  { value: "week", label: "Last 7 days", range: (t: string) => [shiftIsoDay(t, -6), t] },
  { value: "month", label: "This month", range: (t: string) => [`${t.slice(0, 8)}01`, t] },
]

export default function CollectionsPage() {
  const [search, setSearch] = useState("")
  const [term, setTerm] = useState("")
  const [filters, setFilters] = useState(NO_FILTERS)
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRows] = useState(20)
  const [attempt, setAttempt] = useState(0)
  const [options, setOptions] = useState<RegisterFilters | null>(null)
  const [openReceipt, setOpenReceipt] = useState<number | null>(null)

  const [data, setData] = useState<RegisterPage | null>(null)
  const [error, setError] = useState("")
  /** The request `data` or `error` belongs to; anything else is still loading. */
  const [settled, setSettled] = useState("")

  const hasFilters = Boolean(search || Object.values(filters).some(Boolean))

  // Wait for a pause in typing rather than querying on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search.trim())
      setPage(1)
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [search])

  const query = new URLSearchParams({
    page: String(page),
    limit: String(rowsPerPage),
    ...(term ? { q: term } : {}),
    ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
  }).toString()
  const requestKey = `${query}#${attempt}`
  const loading = settled !== requestKey

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const response = await fetch(`/api/collections?${query}`, {
          signal: controller.signal,
        })
        const body = (await response.json().catch(() => null)) as
          | (RegisterPage & { error?: string })
          | null
        if (!response.ok || !body) {
          throw new Error(body?.error ?? "Could not load collections.")
        }
        setData(body)
        setError("")
      } catch (e) {
        if (controller.signal.aborted) return
        setError(e instanceof Error ? e.message : "Could not load collections.")
      }
      setSettled(requestKey)
    }

    void load()
    return () => controller.abort()
  }, [query, requestKey])

  // A failure only leaves these menus short; the register still works.
  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/collections/filters", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: RegisterFilters | null) => setOptions(body))
      .catch(() => {})
    return () => controller.abort()
  }, [])

  function setFilter(next: Partial<typeof NO_FILTERS>) {
    setFilters((f) => ({ ...f, ...next }))
    setPage(1)
  }

  function handlePeriod(value: string) {
    const period = PERIODS.find((p) => p.value === value)
    const [from, to] = period ? period.range(today()) : ["", ""]
    setFilter({ from, to })
  }

  function handleClear() {
    setSearch("")
    setTerm("")
    setFilters(NO_FILTERS)
    setPage(1)
  }

  const rows = data?.rows ?? []
  const stats = data?.stats
  const totalPages = data?.totalPages ?? 1

  const activePeriod = PERIODS.find((p) => {
    const [from, to] = p.range(today())
    return from === filters.from && to === filters.to
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile
          index={0}
          label="Today collected"
          value={stats?.todayTotal ?? 0}
          format={inrCompact}
          tone="brand"
        />
        <StatTile
          index={1}
          label={hasFilters ? `Selected · ${stats?.receiptCount ?? 0}` : `All · ${stats?.receiptCount ?? 0}`}
          value={stats?.receiptsTotal ?? 0}
          format={inrCompact}
          tone="success"
        />
        <StatTile
          index={2}
          label="Cash"
          value={stats?.byMode.cash ?? 0}
          format={inrCompact}
        />
        <StatTile
          index={3}
          label="Online"
          value={stats?.byMode.online ?? 0}
          format={inrCompact}
        />
        <StatTile
          index={4}
          label="Cheque"
          value={stats?.byMode.cheque ?? 0}
          format={inrCompact}
        />
      </div>

      <Toolbar showClear={hasFilters} onClear={handleClear}>
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search receipt, member, account, mobile, group or UTR…"
          className="min-w-[260px] flex-1"
        />
        <Select
          value={activePeriod?.value ?? (filters.from || filters.to ? "custom" : "")}
          onChange={(e) => handlePeriod(e.target.value)}
          wrapperClassName="w-36"
          aria-label="Period"
        >
          <option value="">All dates</option>
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
          {!activePeriod && (filters.from || filters.to) && (
            <option value="custom">Custom</option>
          )}
        </Select>
        <Input
          type="date"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(e) => setFilter({ from: e.target.value })}
          className="tnum w-40"
          aria-label="From date"
        />
        <Input
          type="date"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(e) => setFilter({ to: e.target.value })}
          className="tnum w-40"
          aria-label="To date"
        />
        <Select
          value={filters.route}
          onChange={(e) => setFilter({ route: e.target.value })}
          wrapperClassName="w-40"
          aria-label="Route"
        >
          <option value="">All routes</option>
          {options?.routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.code} · {r.name}
            </option>
          ))}
        </Select>
        <Combobox
          value={filters.group}
          onChange={(group) => setFilter({ group })}
          options={[
            { value: "", label: "All groups" },
            ...(options?.groups.map((g) => ({ value: g, label: g })) ?? []),
          ]}
          placeholder="All groups"
          searchPlaceholder="Search groups…"
          className="w-40"
          aria-label="Group"
        />
        <Select
          value={filters.collector}
          onChange={(e) => setFilter({ collector: e.target.value })}
          wrapperClassName="w-40"
          aria-label="Collected by"
        >
          <option value="">All collectors</option>
          {options?.collectors.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select
          value={filters.mode}
          onChange={(e) => setFilter({ mode: e.target.value })}
          wrapperClassName="w-36"
          aria-label="Payment mode"
        >
          <option value="">All modes</option>
          {COLLECTION_MODES.map((m) => (
            <option key={m} value={m} className="capitalize">
              {m}
            </option>
          ))}
        </Select>
      </Toolbar>

      <Card
        className="reveal overflow-hidden"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        <CardHeader>
          <CardTitle>
            Collection register
            <span className="tnum ml-2 text-xs font-normal text-muted-foreground">
              {data?.total ?? 0} records
            </span>
          </CardTitle>
        </CardHeader>

        <TableWrap>
          <Table>
            <THead>
              <tr>
                {COLUMNS.map((h) => (
                  <TH key={h}>{h}</TH>
                ))}
              </tr>
            </THead>
            <TBody>
              {error ? (
                <tr>
                  <td colSpan={COLUMNS.length}>
                    <EmptyState
                      icon={<ReceiptText className="h-5 w-5" />}
                      title="Could not load collections"
                      description={error}
                      action={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAttempt((a) => a + 1)}
                        >
                          Try again
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : loading && !data ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={COLUMNS.length} className="px-4 py-2">
                      <Skeleton className="h-6" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length}>
                    <EmptyState
                      icon={<ReceiptText className="h-5 w-5" />}
                      title="No collections found"
                      description={
                        hasFilters
                          ? "Try relaxing the filters above."
                          : "Receipts appear here as routes collect in the mobile app."
                      }
                      action={
                        hasFilters ? (
                          <Button variant="outline" size="sm" onClick={handleClear}>
                            Clear filters
                          </Button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                rows.map((c, idx) => (
                  <TR key={c.id} index={idx}>
                    <TD className="font-mono text-xs">{c.receiptNo}</TD>
                    <TD className="font-medium text-foreground">{c.customerName}</TD>
                    <TD>{c.group}</TD>
                    <TD className="tnum text-center">{c.installment}</TD>
                    <TD className="tnum font-semibold text-foreground">
                      {inr(c.amount)}
                    </TD>
                    <TD>
                      <Badge tone={toneFor(c.mode)}>{c.mode}</Badge>
                      {c.reference && (
                        <span className="tnum mt-0.5 block text-2xs text-muted-foreground">
                          {c.reference}
                        </span>
                      )}
                    </TD>
                    <TD className="tnum whitespace-nowrap">{c.date}</TD>
                    <TD className="whitespace-nowrap">
                      {c.route ?? <span className="text-muted-foreground/60">—</span>}
                    </TD>
                    <TD className="whitespace-nowrap">{c.collectedBy}</TD>
                    <TD>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenReceipt(c.id)}
                        aria-label={`View receipt ${c.receiptNo}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </TableWrap>

        <Pagination
          page={Math.min(page, totalPages)}
          totalPages={totalPages}
          totalRows={data?.total ?? 0}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          onRowsChange={(r) => {
            setRows(r)
            setPage(1)
          }}
        />
      </Card>

      <ReceiptDialog id={openReceipt} onClose={() => setOpenReceipt(null)} />
    </div>
  )
}
