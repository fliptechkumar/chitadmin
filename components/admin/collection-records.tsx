"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  CalendarClock,
  CircleDashed,
  Clock,
  Download,
  Loader2,
  NotebookPen,
  Phone,
  RotateCcw,
  Save,
  Trophy,
  Wand2,
  X,
} from "lucide-react"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { EmptyState } from "@/components/ui/empty-state"
import { Select } from "@/components/ui/input"
import { ProgressBar } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import {
  MAX_RECORD_AMOUNT,
  monthName,
  parseRecords,
  recordStatus,
  type MonthRecord,
  type RecordErrors,
  type RecordStatus,
  type SeatOption,
  type SeatRecords,
} from "@/lib/collection-records"
import { inr } from "@/lib/format"
import { cn } from "@/lib/utils"

type GroupOption = {
  id: number
  group: string
  branchName: string
  amount: number
  totalTickets: number
  members: number
}
type RouteOption = { id: number; code: string; name: string; branch: string }

/** One editable row, held as the strings the inputs produce. */
type Draft = { installmentNo: number; amount: string; date: string; routeId: string }

const STATUS: Record<RecordStatus, { label: string; tone: BadgeTone; icon: React.ReactNode }> = {
  paid: { label: "Paid", tone: "success", icon: <CheckCircle2 className="h-3 w-3" /> },
  advance: { label: "Advance", tone: "brand", icon: <CheckCircle2 className="h-3 w-3" /> },
  part: { label: "Part paid", tone: "warning", icon: <CircleDashed className="h-3 w-3" /> },
  pending: { label: "Pending", tone: "danger", icon: <Clock className="h-3 w-3" /> },
  upcoming: { label: "Upcoming", tone: "neutral", icon: null },
}

const cellInput =
  "tnum h-8 w-full rounded-md border border-input bg-surface-2 px-2 text-sm text-foreground outline-none transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground/50 hover:border-border focus:border-brand focus:bg-card focus:ring-4 focus:ring-brand/12"

/** Saved values become the form's defaults; an empty month defaults to its due date. */
function toDrafts(records: MonthRecord[]): Draft[] {
  return records.map((r) => ({
    installmentNo: r.installmentNo,
    amount: r.amount > 0 ? String(r.amount) : "",
    date: r.date ?? r.dueDate,
    routeId: r.routeId ? String(r.routeId) : "",
  }))
}

const sameDraft = (a: Draft, b: Draft) =>
  a.amount === b.amount && a.routeId === b.routeId && (a.date === b.date || (!a.amount && !b.amount))

function formatDay(day: string) {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

export default function CollectionRecords({
  groups,
  routes,
  today,
}: {
  groups: GroupOption[]
  routes: RouteOption[]
  today: string
}) {
  const [groupId, setGroupId] = useState("")
  const [ticketId, setTicketId] = useState("")
  const [seats, setSeats] = useState<SeatOption[]>([])
  const [seatsLoading, setSeatsLoading] = useState(false)

  const [data, setData] = useState<SeatRecords | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<RecordErrors>({})
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  /** Saved months should take the scheme's configured dues on the next save. */
  const [applySchedule, setApplySchedule] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)

  const sortedGroups = useMemo(
    () =>
      [...groups].sort(
        (a, b) =>
          a.branchName.localeCompare(b.branchName) ||
          a.group.localeCompare(b.group, undefined, { numeric: true })
      ),
    [groups]
  )
  const groupOptions = useMemo<ComboboxOption[]>(
    () =>
      sortedGroups.map((g) => ({
        value: String(g.id),
        label: g.group,
        hint: `${inr(g.amount)} · ${g.totalTickets} mo`,
        group: g.branchName,
      })),
    [sortedGroups]
  )

  const original = useMemo(() => (data ? toDrafts(data.records) : []), [data])
  const dirtyRows = drafts.filter((d, i) => original[i] && !sameDraft(d, original[i])).length
  const dirty = dirtyRows > 0 || applySchedule

  /** The due amount a month shows: the schedule's when it is being applied. */
  const dueOf = (r: MonthRecord) =>
    applySchedule && r.scheduledDue !== null ? r.scheduledDue : r.amountDue
  const offSchedule = data
    ? data.records.filter((r) => r.saved && r.scheduledDue !== null && r.scheduledDue !== r.amountDue).length
    : 0

  // Unsaved edits should not vanish with a stray refresh.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  // Success notices clear themselves; errors stay until acted on.
  useEffect(() => {
    if (message?.tone !== "success") return
    const timer = setTimeout(() => setMessage(null), 5000)
    return () => clearTimeout(timer)
  }, [message])

  function confirmDiscard() {
    return !dirty || window.confirm("You have unsaved changes. Discard them?")
  }

  async function pickGroup(id: string) {
    // Re-picking the current group should not throw away the loaded customer.
    if (id === groupId || !confirmDiscard()) return
    setGroupId(id)
    setTicketId("")
    setSeats([])
    setData(null)
    setDrafts([])
    setErrors({})
    setMessage(null)
    if (!id) return

    setSeatsLoading(true)
    try {
      const response = await fetch(`/api/collection-records?groupId=${id}`)
      // A crashed request can come back empty; read it without throwing.
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? `Could not load customers (server error ${response.status}).`)
      setSeats(body as SeatOption[])
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not load customers." })
    } finally {
      setSeatsLoading(false)
    }
  }

  async function loadRecords(id = ticketId) {
    if (!groupId || !id) {
      setMessage({ tone: "error", text: "Select a group and a customer first." })
      return
    }
    if (data && !confirmDiscard()) return

    setLoading(true)
    setErrors({})
    setMessage(null)
    try {
      const response = await fetch(`/api/collection-records/${id}`)
      // A crashed request can come back empty; read it without throwing.
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? `Could not load records (server error ${response.status}).`)
      const next = body as SeatRecords
      setData(next)
      setDrafts(toDrafts(next.records))
      setApplySchedule(false)
    } catch (e) {
      setData(null)
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not load records." })
    } finally {
      setLoading(false)
    }
  }

  function update(index: number, patch: Partial<Draft>) {
    setDrafts((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
    const no = drafts[index]?.installmentNo
    if (no && errors[no]) {
      setErrors((e) => {
        const next = { ...e }
        delete next[no]
        return next
      })
    }
  }

  /** Fills a month with its full due amount, dated on the due day (or today if that is still ahead). */
  function fillDue(index: number) {
    const r = data?.records[index]
    if (!r) return
    update(index, {
      amount: String(dueOf(r)),
      date: drafts[index].amount ? drafts[index].date : r.dueDate > today ? today : r.dueDate,
    })
  }

  function applyRouteToAll(routeId: string) {
    if (!routeId) return
    setDrafts((rows) => rows.map((r) => ({ ...r, routeId })))
  }

  async function save() {
    if (!data) return
    const payload = drafts.map((d) => ({
      installmentNo: d.installmentNo,
      amount: d.amount.trim() === "" ? 0 : Number(d.amount),
      date: d.date || null,
      routeId: d.routeId ? Number(d.routeId) : null,
    }))

    // Same rules as the server, so mistakes show before the round trip.
    const checked = parseRecords(payload, data.seat.months, today)
    if (!checked.ok) {
      setErrors(checked.errors)
      setMessage({
        tone: "error",
        text: checked.message ?? `Fix ${Object.keys(checked.errors).length} highlighted month(s) before saving.`,
      })
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/collection-records/${data.seat.ticketId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: payload, applySchedule }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        if (body?.errors) setErrors(body.errors as RecordErrors)
        throw new Error(body?.error ?? "Could not save records.")
      }
      // The response is the ledger re-read from the database after saving.
      const fresh = body as SeatRecords
      setData(fresh)
      setDrafts(toDrafts(fresh.records))
      setApplySchedule(false)
      setErrors({})
      setSeats((list) =>
        list.map((s) => (s.ticketId === fresh.seat.ticketId ? { ...s, saved: fresh.seat.saved } : s))
      )
      setMessage({
        tone: "success",
        text: `Saved ${fresh.seat.months} monthly records for ${fresh.seat.name}.`,
      })
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not save records." })
    } finally {
      setSaving(false)
    }
  }

  // Live figures from what is on screen, saved or not.
  const live = useMemo(() => {
    if (!data) return null
    const rows = data.records.map((r, i) => ({
      ...r,
      amountDue: dueOf(r),
      amount: Number(drafts[i]?.amount) || 0,
    }))
    const collected = rows.reduce((s, r) => s + r.amount, 0)
    const dueToDate = rows.filter((r) => r.dueDate <= today).reduce((s, r) => s + r.amountDue, 0)
    const scheme = rows.reduce((s, r) => s + r.amountDue, 0)
    const paidMonths = rows.filter((r) => r.amount > 0 && r.amount >= r.amountDue).length
    return { rows, collected, dueToDate, scheme, paidMonths, balance: Math.max(0, dueToDate - collected) }
    // dueOf reads applySchedule, which is listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, drafts, today, applySchedule])

  const branchRoutes = data ? routes.filter((r) => r.branch === data.seat.branch) : []
  const selectedGroup = groups.find((g) => String(g.id) === groupId)
  const seatRoute = data?.seat.routeId ? routes.find((r) => r.id === data.seat.routeId) : null

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="reveal flex items-center gap-3" style={{ "--i": 0 } as React.CSSProperties}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
          <NotebookPen className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Collection records</h2>
          <p className="text-sm text-muted-foreground">
            Keep each customer&apos;s month-by-month collections — amount, date and route.
          </p>
        </div>
      </div>

      {/* Pickers */}
      <Card className="reveal p-4" style={{ "--i": 1 } as React.CSSProperties}>
        <form
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            void loadRecords()
          }}
        >
          <Picker label="Select group" step={1}>
            <Combobox
              value={groupId}
              onChange={(id) => void pickGroup(id)}
              options={groupOptions}
              placeholder="Choose a group…"
              searchPlaceholder="Search group, branch or value…"
              emptyText="No groups match your search"
              aria-label="Select group"
            />
          </Picker>

          <Picker label="Select customer" step={2}>
            <Select
              value={ticketId}
              onChange={(e) => {
                if (!confirmDiscard()) return
                setTicketId(e.target.value)
                setData(null)
                setDrafts([])
                setErrors({})
              }}
              disabled={!groupId || seatsLoading}
              aria-label="Select customer"
            >
              <option value="">
                {!groupId
                  ? "Select a group first"
                  : seatsLoading
                    ? "Loading customers…"
                    : seats.length
                      ? `Choose from ${seats.length} customers…`
                      : "No customers seated in this group"}
              </option>
              {seats.map((s) => (
                <option key={s.ticketId} value={s.ticketId}>
                  T-{String(s.ticketNo).padStart(2, "0")} · {s.name} · {s.accountNo}
                  {s.saved ? ` · ${s.saved} saved` : ""}
                </option>
              ))}
            </Select>
          </Picker>

          <Button type="submit" disabled={!groupId || !ticketId || loading} className="md:mb-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Load records
          </Button>
        </form>
      </Card>

      {message && (
        <div
          role={message.tone === "error" ? "alert" : "status"}
          className={cn(
            "animate-scale-in flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
            message.tone === "success"
              ? "bg-success-soft text-success-soft-foreground"
              : "bg-danger-soft text-danger-soft-foreground"
          )}
        >
          {message.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="flex-1">{message.text}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setMessage(null)} className="opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading && !data ? (
        <Card className="space-y-2 p-4">
          <Skeleton className="h-16" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </Card>
      ) : !data || !live ? (
        <Card>
          <EmptyState
            icon={<NotebookPen className="h-5 w-5" />}
            title={selectedGroup ? "Choose a customer" : "Choose a group to begin"}
            description={
              selectedGroup
                ? `Pick a customer in ${selectedGroup.group}, then load their ${selectedGroup.totalTickets} monthly records.`
                : "Select a group, then a customer in it, and load their monthly records to view or edit."
            }
          />
        </Card>
      ) : (
        <>
          {/* Customer summary */}
          <Card className="reveal overflow-hidden" style={{ "--i": 2 } as React.CSSProperties}>
            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)] lg:items-center">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold uppercase text-brand-foreground">
                  {data.seat.name.slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-semibold text-foreground">
                    {data.seat.name}
                    {data.seat.isPrized && (
                      <Badge tone="warning">
                        <Trophy className="h-3 w-3" />
                        Prized
                      </Badge>
                    )}
                  </p>
                  <p className="tnum flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>{data.seat.accountNo}</span>
                    {data.seat.mobile && (
                      <a href={`tel:${data.seat.mobile}`} className="flex items-center gap-1 text-brand hover:underline">
                        <Phone className="h-3 w-3" />
                        {data.seat.mobile}
                      </a>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.seat.group} · Ticket {data.seat.ticketNo} · {inr(data.seat.chitValue)} · {data.seat.branch}
                    {seatRoute && ` · Route ${seatRoute.code}`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Figure label="Collected" value={inr(live.collected)} tone="text-success-soft-foreground" />
                <Figure label="Due to date" value={inr(live.dueToDate)} />
                <Figure
                  label="Balance"
                  value={inr(live.balance)}
                  tone={live.balance ? "text-danger-soft-foreground" : "text-foreground"}
                />
                <div className="rounded-lg bg-surface-2 p-3">
                  <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Months paid</p>
                  <p className="tnum text-lg font-bold text-foreground">
                    {live.paidMonths}
                    <span className="text-sm font-medium text-muted-foreground"> / {data.seat.months}</span>
                  </p>
                  <ProgressBar pct={(live.paidMonths / data.seat.months) * 100} className="mt-1 h-1.5" />
                </div>
              </div>
            </div>
          </Card>

          {/* Which schedule the dues follow */}
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-2.5 text-sm",
              data.schedule ? "border-brand/25 bg-brand-soft/40" : "border-dashed border-border bg-surface-2"
            )}
          >
            <CalendarClock className={cn("h-4 w-4 shrink-0", data.schedule ? "text-brand" : "text-muted-foreground")} />
            {data.schedule ? (
              <>
                <span className="text-foreground">
                  Dues follow the <span className="font-semibold">{data.schedule.scheme}</span> chit interval.
                </span>
                {applySchedule ? (
                  <>
                    <span className="text-muted-foreground">
                      {offSchedule} saved month{offSchedule === 1 ? "" : "s"} will take the scheme&apos;s due on save.
                    </span>
                    <Button variant="ghost" size="xs" className="ml-auto" onClick={() => setApplySchedule(false)}>
                      Undo
                    </Button>
                  </>
                ) : offSchedule > 0 ? (
                  <>
                    <span className="text-muted-foreground">
                      {offSchedule} saved month{offSchedule === 1 ? "" : "s"} differ from it and keep their own due.
                    </span>
                    <Button variant="outline" size="xs" className="ml-auto" onClick={() => setApplySchedule(true)}>
                      Apply schedule
                    </Button>
                  </>
                ) : null}
              </>
            ) : (
              <span className="text-muted-foreground">
                No chit interval is configured for this scheme, so dues use the monthly share. Set one up
                under Chit Interval.
              </span>
            )}
          </div>

          {/* Records */}
          <Card ref={tableRef} className="reveal scroll-mt-4 overflow-hidden" style={{ "--i": 3 } as React.CSSProperties}>
            <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div>
                <CardTitle>Monthly records</CardTitle>
                <CardDescription>
                  {data.seat.saved === 0
                    ? `No records saved yet — ${data.seat.months} months prepared from the scheme`
                    : `${data.seat.saved} of ${data.seat.months} months saved`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                <Select
                  value=""
                  onChange={(e) => applyRouteToAll(e.target.value)}
                  wrapperClassName="w-full sm:w-52"
                  aria-label="Apply a route to every month"
                >
                  <option value="">Set route for all months…</option>
                  {branchRoutes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} · {r.name}
                    </option>
                  ))}
                </Select>
              </div>
            </CardHeader>

            <TableWrap>
              <Table className="min-w-[860px]">
                <THead>
                  <tr>
                    <TH className="w-12">#</TH>
                    <TH>Month</TH>
                    <TH className="text-right">Due</TH>
                    <TH className="w-[170px]">Date</TH>
                    <TH className="w-[170px]">Amount</TH>
                    <TH className="w-[200px]">Route</TH>
                    <TH>Status</TH>
                  </tr>
                </THead>
                <TBody key={data.seat.ticketId}>
                  {drafts.map((d, i) => {
                    const r = data.records[i]
                    const err = errors[d.installmentNo]
                    const changed = original[i] && !sameDraft(d, original[i])
                    const due = dueOf(r)
                    const status = recordStatus({ ...r, amountDue: due, amount: Number(d.amount) || 0 }, today)
                    const s = STATUS[status]
                    return (
                      <TR
                        key={d.installmentNo}
                        index={Math.min(i, 14)}
                        className={cn(
                          err && "bg-danger-soft/40 hover:bg-danger-soft/50",
                          !err && changed && "bg-brand-soft/40 hover:bg-brand-soft/50"
                        )}
                      >
                        <TD className="tnum text-xs">
                          <span className="relative">
                            {d.installmentNo}
                            {changed && (
                              <span className="absolute -left-2.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand" title="Edited" />
                            )}
                          </span>
                        </TD>
                        <TD className="whitespace-nowrap">
                          <p className="font-medium text-foreground">{monthName(r.dueDate)}</p>
                          <p className="tnum text-xs text-muted-foreground">Due {formatDay(r.dueDate)}</p>
                        </TD>
                        <TD className="tnum whitespace-nowrap text-right text-sm">
                          <span className={cn(due !== r.amountDue && "font-semibold text-brand")}>{inr(due)}</span>
                          {r.saved && r.scheduledDue !== null && r.scheduledDue !== due && (
                            <span
                              className="block text-2xs text-warning-soft-foreground"
                              title="The saved due differs from the scheme's chit interval"
                            >
                              Scheme {inr(r.scheduledDue)}
                            </span>
                          )}
                          {due !== r.amountDue && (
                            <span className="block text-2xs text-muted-foreground line-through">{inr(r.amountDue)}</span>
                          )}
                        </TD>
                        <TD>
                          <input
                            type="date"
                            value={d.date}
                            max={today}
                            onChange={(e) => update(i, { date: e.target.value })}
                            aria-label={`Collection date, month ${d.installmentNo}`}
                            aria-invalid={Boolean(err?.date)}
                            className={cn(cellInput, err?.date && "border-danger focus:border-danger focus:ring-danger/15", !d.amount && "text-muted-foreground")}
                          />
                          {err?.date && <p className="mt-1 text-2xs font-medium text-danger">{err.date}</p>}
                        </TD>
                        <TD>
                          <div className="flex items-center gap-1">
                            <div className="relative flex-1">
                              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                              <input
                                inputMode="numeric"
                                value={d.amount}
                                placeholder="0"
                                onChange={(e) =>
                                  update(i, { amount: e.target.value.replace(/[^\d]/g, "").slice(0, String(MAX_RECORD_AMOUNT).length) })
                                }
                                onFocus={(e) => e.target.select()}
                                aria-label={`Amount, month ${d.installmentNo}`}
                                aria-invalid={Boolean(err?.amount)}
                                className={cn(cellInput, "pl-5 text-right font-semibold", err?.amount && "border-danger focus:border-danger focus:ring-danger/15")}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              title={`Fill full due (${inr(due)})`}
                              aria-label={`Fill full due for month ${d.installmentNo}`}
                              onClick={() => fillDue(i)}
                              disabled={Number(d.amount) === due}
                            >
                              <Wand2 />
                            </Button>
                          </div>
                          {err?.amount && <p className="mt-1 text-2xs font-medium text-danger">{err.amount}</p>}
                        </TD>
                        <TD>
                          <Select
                            value={d.routeId}
                            onChange={(e) => update(i, { routeId: e.target.value })}
                            className={cn("h-8 text-sm", err?.route && "border-danger")}
                            aria-label={`Route, month ${d.installmentNo}`}
                          >
                            <option value="">No route</option>
                            {branchRoutes.map((route) => (
                              <option key={route.id} value={route.id}>
                                {route.code} · {route.name}
                              </option>
                            ))}
                          </Select>
                          {err?.route && <p className="mt-1 text-2xs font-medium text-danger">{err.route}</p>}
                        </TD>
                        <TD>
                          <div className="flex items-center gap-1.5">
                            <Badge tone={s.tone}>
                              {s.icon}
                              {s.label}
                            </Badge>
                            {!r.saved && <span className="text-2xs text-muted-foreground">new</span>}
                          </div>
                        </TD>
                      </TR>
                    )
                  })}
                </TBody>
                <tfoot className="border-t border-border bg-surface-2 text-sm">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-foreground" colSpan={2}>
                      Total · {data.seat.months} months
                    </td>
                    <td className="tnum px-4 py-3 text-right font-bold text-foreground">{inr(live.scheme)}</td>
                    <td />
                    <td className="tnum px-4 py-3 text-right font-bold text-success-soft-foreground">
                      {inr(live.collected)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </Table>
            </TableWrap>
          </Card>

          {/* Save bar */}
          <div className="sticky bottom-4 z-20">
            <div
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-xl border bg-card/95 px-4 py-3 shadow-lg backdrop-blur transition-colors",
                dirty ? "border-brand/40" : "border-border"
              )}
            >
              <p className="text-sm text-muted-foreground">
                {dirty ? (
                  <>
                    {dirtyRows > 0 && (
                      <>
                        <span className="font-semibold text-foreground">{dirtyRows}</span> month
                        {dirtyRows === 1 ? "" : "s"} changed
                        {applySchedule ? " and " : " — "}
                      </>
                    )}
                    {applySchedule && "scheme dues to apply — "}
                    not saved yet
                  </>
                ) : data.seat.saved === 0 ? (
                  "Nothing saved yet. Save to create this customer's monthly records."
                ) : (
                  "All changes saved."
                )}
              </p>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!dirty || saving}
                  onClick={() => {
                    setDrafts(original)
                    setApplySchedule(false)
                    setErrors({})
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Discard
                </Button>
                <Button size="sm" onClick={() => void save()} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save records
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Picker({ label, step, children }: { label: string; step: number; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <label className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-soft text-[10px] text-brand-soft-foreground">
          {step}
        </span>
        {label}
      </label>
      {children}
    </div>
  )
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("tnum text-lg font-bold", tone ?? "text-foreground")}>{value}</p>
    </div>
  )
}
