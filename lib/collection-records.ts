/**
 * Collection records: a seat's month-by-month ledger as edited on the
 * Collection Records page. Kept free of server imports so the form validates
 * with exactly the rules the API enforces on save.
 *
 * Each record is a TicketDue row — the same ledger the dues register and the
 * route collection sheet read — so saving here is what feeds those reports.
 */

/** Guards against a typo adding a crore to someone's ledger. */
export const MAX_RECORD_AMOUNT = 10_000_000

export type SeatOption = {
  ticketId: number
  ticketNo: number
  name: string
  accountNo: string
  mobile: string
  routeId: number | null
  isPrized: boolean
  /** Months already saved for this seat. */
  saved: number
}

export type MonthRecord = {
  installmentNo: number
  /** Scheduled due date, yyyy-mm-dd. */
  dueDate: string
  /** Instalment owed that month, as stored (or as it would be created). */
  amountDue: number
  /** What the scheme's chit interval sets for the month, when one applies. */
  scheduledDue: number | null
  /** Collected; 0 when nothing has come in. */
  amount: number
  /** Collection date, yyyy-mm-dd; null when nothing has come in. */
  date: string | null
  routeId: number | null
  /** Whether a row exists in the database yet. */
  saved: boolean
}

export type SeatRecords = {
  seat: SeatOption & {
    group: string
    groupId: number
    branch: string
    chitValue: number
    months: number
  }
  /** The chit interval the seat's dues follow, if its scheme has one. */
  schedule: { intervalId: number; scheme: string } | null
  records: MonthRecord[]
}

/** What the form sends for one month. */
export type RecordInput = {
  installmentNo: number
  amount: number
  date: string | null
  routeId: number | null
}

export type RecordErrors = Record<number, { amount?: string; date?: string; route?: string }>

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

function isRealDay(value: string) {
  if (!ISO_DAY.test(value)) return false
  const [y, m, d] = value.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

/**
 * Validates a whole ledger. `today` is yyyy-mm-dd: a collection cannot be
 * dated in the future. `months` is the scheme length the rows must cover.
 */
export function parseRecords(
  raw: unknown,
  months: number,
  today: string
): { ok: true; data: RecordInput[] } | { ok: false; errors: RecordErrors; message?: string } {
  if (!Array.isArray(raw)) return { ok: false, errors: {}, message: "No records sent." }
  if (raw.length !== months) {
    return { ok: false, errors: {}, message: `Expected ${months} monthly records.` }
  }

  const errors: RecordErrors = {}
  const data: RecordInput[] = []
  const seen = new Set<number>()

  for (const item of raw as Record<string, unknown>[]) {
    const installmentNo = Number(item?.installmentNo)
    if (!Number.isInteger(installmentNo) || installmentNo < 1 || installmentNo > months || seen.has(installmentNo)) {
      return { ok: false, errors: {}, message: "Records do not match the scheme's months." }
    }
    seen.add(installmentNo)

    const rowErrors: RecordErrors[number] = {}

    const rawAmount = item.amount === "" || item.amount === null || item.amount === undefined ? 0 : Number(item.amount)
    if (!Number.isInteger(rawAmount) || rawAmount < 0) {
      rowErrors.amount = "Whole rupees, zero or more"
    } else if (rawAmount > MAX_RECORD_AMOUNT) {
      rowErrors.amount = "Amount looks too large"
    }

    const rawDate = typeof item.date === "string" && item.date ? item.date : null
    // Empty months carry their due date as a placeholder; it is dropped, so only check dated collections.
    if (rawAmount > 0) {
      if (!rawDate) rowErrors.date = "Date is required with an amount"
      else if (!isRealDay(rawDate)) rowErrors.date = "Not a valid date"
      else if (rawDate > today) rowErrors.date = "Cannot be in the future"
    }

    const routeId = item.routeId === null || item.routeId === undefined || item.routeId === "" ? null : Number(item.routeId)
    if (routeId !== null && (!Number.isInteger(routeId) || routeId < 1)) {
      rowErrors.route = "Unknown route"
    }

    if (Object.keys(rowErrors).length) errors[installmentNo] = rowErrors

    data.push({
      installmentNo,
      amount: rawAmount,
      // A month with nothing collected carries no collection date.
      date: rawAmount > 0 ? rawDate : null,
      routeId,
    })
  }

  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, data: data.sort((a, b) => a.installmentNo - b.installmentNo) }
}

/** "Oct 2026" for a yyyy-mm-dd day. */
export function monthName(day: string) {
  const [y, m] = day.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
}

export type RecordStatus = "paid" | "part" | "advance" | "pending" | "upcoming"

export function recordStatus(r: Pick<MonthRecord, "amount" | "amountDue" | "dueDate">, today: string): RecordStatus {
  if (r.amount > 0 && r.amount > r.amountDue) return "advance"
  if (r.amount > 0 && r.amount === r.amountDue) return "paid"
  if (r.amount > 0) return "part"
  return r.dueDate > today ? "upcoming" : "pending"
}
