/**
 * Denomination report: shared types and arithmetic. Free of server imports so
 * the tally editor can total a count as it is typed, using the same rules the
 * API applies when it is saved.
 */

/** Face values counted at day end, largest first. */
export const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const

export type Denomination = (typeof DENOMINATIONS)[number]

/** Values from here down are usually coins; the editor groups them apart. */
export const COIN_THRESHOLD = 5

/** Pieces of each value: { "500": 12, "200": 4 }. Missing keys mean zero. */
export type DenominationCounts = Partial<Record<`${Denomination}`, number>>

/** A day's register cannot plausibly hold more than this of one value. */
const MAX_PIECES = 100_000

export function denominationTotal(counts: DenominationCounts): number {
  return DENOMINATIONS.reduce(
    (sum, value) => sum + value * (counts[`${value}`] ?? 0),
    0
  )
}

export function pieceCount(counts: DenominationCounts): number {
  return DENOMINATIONS.reduce((sum, value) => sum + (counts[`${value}`] ?? 0), 0)
}

/** Adds several counts together, for the all-routes view. */
export function sumCounts(list: DenominationCounts[]): DenominationCounts {
  const out: DenominationCounts = {}
  for (const counts of list) {
    for (const value of DENOMINATIONS) {
      const n = counts[`${value}`] ?? 0
      if (n) out[`${value}`] = (out[`${value}`] ?? 0) + n
    }
  }
  return out
}

/**
 * Normalises untrusted input into counts: known face values only, whole
 * numbers only, zeros dropped. Returns null if any value is malformed.
 */
export function parseCounts(raw: unknown): DenominationCounts | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const body = raw as Record<string, unknown>
  const out: DenominationCounts = {}

  for (const value of DENOMINATIONS) {
    const entry = body[`${value}`]
    if (entry === undefined || entry === null || entry === "") continue
    const n = Number(entry)
    if (!Number.isInteger(n) || n < 0 || n > MAX_PIECES) return null
    if (n > 0) out[`${value}`] = n
  }

  return out
}

// ---------------------------------------------------------------------------
// Dates — the report is keyed by calendar day, never by instant
// ---------------------------------------------------------------------------

/** yyyy-mm-dd, as an <input type="date"> reads and writes it. */
export function isIsoDay(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

/** yyyy-mm-dd → dd/MM/yyyy, the format collections are stored under. */
export function isoToDisplay(day: string) {
  const [y, m, d] = day.split("-")
  return `${d}/${m}/${y}`
}

/** Today as yyyy-mm-dd in the viewer's local time. */
export function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Fri, 09 Oct 2026 — a yyyy-mm-dd day for headings, without a timezone shift. */
export function formatReportDay(day: string) {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/** Moves a yyyy-mm-dd day by `delta` days without a timezone round trip. */
export function shiftIsoDay(day: string, delta: number) {
  const [y, m, d] = day.split("-").map(Number)
  const next = new Date(y, m - 1, d + delta)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`
}

// ---------------------------------------------------------------------------
// Report payload
// ---------------------------------------------------------------------------

/** Route filter value for receipts not placed on any route. */
export const UNASSIGNED = "unassigned"

export type DenominationRow = {
  id: number
  receiptNo: string
  /** ISO instant the receipt was written. */
  createdAt: string
  customerName: string
  group: string
  installment: number
  mode: "cash" | "online" | "cheque"
  amount: number
  penalty: number
  /** amount + penalty: what was actually handed over. */
  total: number
  collectedBy: string
  branch: string
  routeId: number | null
}

/** One cash-handover unit: a route on a day, or a branch's unrouted receipts. */
export type RouteSummary = {
  /** Matches CashDenomination.scopeKey. */
  key: string
  branch: string
  routeId: number | null
  code: string
  name: string
  executives: string[]
  receipts: number
  cash: number
  online: number
  cheque: number
  total: number
  /** Null until someone has counted this route's cash. */
  tally: {
    counts: DenominationCounts
    total: number
    remarks: string
    countedBy: string
    updatedAt: string
  } | null
}

export type DenominationReport = {
  date: string
  rows: DenominationRow[]
  routes: RouteSummary[]
}

export function scopeKeyFor(branch: string, routeId: number | null) {
  return `${branch}|${routeId ?? "-"}`
}

/** Positive: more cash counted than receipted. Negative: a shortage. */
export function varianceOf(route: Pick<RouteSummary, "cash" | "tally">) {
  return route.tally ? route.tally.total - route.cash : null
}
