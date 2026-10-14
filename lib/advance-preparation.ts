/**
 * Route collection sheet (the old "Advance Preparation" report): shared types and filtering. Free of server
 * imports so the screen filters exactly as the Excel export does.
 */

export const PAY_STATUSES = ["paid", "part_paid", "not_paid", "no_due"] as const
export type PayStatus = (typeof PAY_STATUSES)[number]

export const PAY_STATUS_LABELS: Record<PayStatus, string> = {
  paid: "Paid",
  part_paid: "Part paid",
  not_paid: "Not paid",
  no_due: "No due",
}

export const PRIZE_FILTERS = ["", "prized", "non_prized"] as const
export type PrizeFilter = (typeof PRIZE_FILTERS)[number]

export const COLLECTION_TYPES = ["daily", "weekly", "monthly"] as const
export type CollectionTypeValue = (typeof COLLECTION_TYPES)[number]

export type AdvanceRow = {
  ticketId: number
  branch: string
  routeId: number | null
  routeCode: string
  accountNo: string
  name: string
  mobile: string
  area: string
  group: string
  ticketNo: number
  chitValue: number
  isPrized: boolean
  collectionType: CollectionTypeValue
  /** yyyy-mm-dd of the first instalment falling in the period, if any. */
  dueDate: string | null
  /** Latest instalment number falling in the period. */
  installmentNo: number | null
  /** Owed for instalments falling in the period. */
  due: number
  /** Paid against those instalments. */
  paid: number
  /** Earlier instalments still short. Null when there is no ledger to read. */
  arrearsCount: number | null
  arrearsAmount: number | null
  status: PayStatus
  staff: string
  /** Figures derived from the group schedule rather than a dues ledger. */
  estimated: boolean
}

export type AdvanceReport = {
  from: string
  to: string
  rows: AdvanceRow[]
}

export type AdvanceFilters = {
  prize?: PrizeFilter
  type?: CollectionTypeValue | ""
  status?: PayStatus | ""
  q?: string
}

export function statusOf(due: number, paid: number): PayStatus {
  if (due <= 0) return "no_due"
  if (paid >= due) return "paid"
  if (paid > 0) return "part_paid"
  return "not_paid"
}

/** Everything except the status filter, so the status summary stays whole. */
export function filterBase(rows: AdvanceRow[], f: AdvanceFilters): AdvanceRow[] {
  const q = f.q?.trim().toLowerCase() ?? ""
  return rows.filter(
    (r) =>
      (!f.prize || (f.prize === "prized") === r.isPrized) &&
      (!f.type || r.collectionType === f.type) &&
      (!q ||
        r.name.toLowerCase().includes(q) ||
        r.mobile.includes(q) ||
        r.accountNo.toLowerCase().includes(q) ||
        r.area.toLowerCase().includes(q) ||
        r.group.toLowerCase().includes(q))
  )
}

export function filterRows(rows: AdvanceRow[], f: AdvanceFilters): AdvanceRow[] {
  const base = filterBase(rows, f)
  return f.status ? base.filter((r) => r.status === f.status) : base
}

export function summarise(rows: AdvanceRow[]) {
  const due = rows.reduce((s, r) => s + r.due, 0)
  const paid = rows.reduce((s, r) => s + Math.min(r.paid, r.due), 0)
  const advance = rows.reduce((s, r) => s + Math.max(0, r.paid - r.due), 0)
  const arrears = rows.reduce((s, r) => s + (r.arrearsAmount ?? 0), 0)
  const count = (status: PayStatus) => rows.filter((r) => r.status === status).length
  const withDue = rows.filter((r) => r.due > 0).length

  return {
    subscribers: rows.length,
    withDue,
    due,
    paid,
    advance,
    balance: due - paid,
    arrears,
    /** Collected against what fell due, 0–100. */
    efficiency: due ? (paid / due) * 100 : 0,
    paidCount: count("paid"),
    partCount: count("part_paid"),
    notPaidCount: count("not_paid"),
    noDueCount: count("no_due"),
  }
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** First and last day of the month containing `day` (yyyy-mm-dd). */
export function monthRange(day: string): { from: string; to: string } {
  const [y, m] = day.split("-").map(Number)
  const last = new Date(y, m, 0).getDate()
  const mm = String(m).padStart(2, "0")
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, "0")}` }
}

/** Shifts a month range by whole months. */
export function shiftMonth(from: string, delta: number) {
  const [y, m] = from.split("-").map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return monthRange(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
  )
}

/** 01 Oct – 31 Oct 2026 */
export function formatPeriod(from: string, to: string) {
  const fmt = (day: string, withYear: boolean) => {
    const [y, m, d] = day.split("-").map(Number)
    return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
    })
  }
  return `${fmt(from, from.slice(0, 4) !== to.slice(0, 4))} – ${fmt(to, true)}`
}
