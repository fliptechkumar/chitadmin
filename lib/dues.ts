/**
 * How a member's dues position is read off the instalment ledger.
 *
 * Nothing here is stored: status follows from what is owed against what has
 * been paid, so a payment cannot leave a stale flag behind.
 */

export const DUE_STATUSES = ["paid", "part_paid", "pending", "advance"] as const
export type DueStatus = (typeof DUE_STATUSES)[number]

export const DUE_STATUS_LABELS: Record<DueStatus, string> = {
  paid: "Paid",
  part_paid: "Part paid",
  pending: "Pending",
  advance: "Advance",
}

export type DueRow = {
  installmentNo: number
  dueDate: string
  amountDue: number
  amountPaid: number
}

export function statusFor(due: DueRow): DueStatus {
  if (due.amountPaid <= 0) return "pending"
  if (due.amountPaid < due.amountDue) return "part_paid"
  if (due.amountPaid > due.amountDue) return "advance"
  return "paid"
}

export type DuesPosition = {
  /** The instalment the member is currently being asked for. */
  current: DueRow | null
  status: DueStatus
  /** Instalments before the current one that are not settled. */
  pendingCount: number
  /** Total still owed on every instalment up to and including the current one. */
  outstanding: number
  paidToDate: number
  /** Something is owed whose due date has passed. */
  overdue: boolean
  /** The first instalment's month has arrived. */
  started: boolean
}

/** A Date as the calendar day it falls on for the branches, yyyy-mm-dd. */
const istDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })

/**
 * Reduces a member's whole schedule to the row the register shows.
 *
 * "Current" is the instalment falling due this calendar month, or the latest
 * before it. A month opens on the 1st, not on its due date: members pay any
 * day of the month, so with dues on the 13th a payment on the 2nd is this
 * month's instalment, not an advance. Every member of a group is still shown
 * against the same month, so the column lines up down the page.
 *
 * An instalment is overdue the day after its due date. Earlier months still
 * short are reported as `pendingCount`, which the status column cannot show.
 */
export function positionFor(dues: DueRow[], today = new Date()): DuesPosition {
  const ordered = [...dues].sort((a, b) => a.installmentNo - b.installmentNo)
  if (ordered.length === 0) {
    return {
      current: null,
      status: "paid",
      pendingCount: 0,
      outstanding: 0,
      paidToDate: 0,
      overdue: false,
      started: false,
    }
  }

  const todayDay = istDay(today)
  const dayOf = (d: DueRow) => istDay(new Date(d.dueDate))
  const short = (d: DueRow) => d.amountPaid < d.amountDue

  // Months whose instalment falls in this calendar month or earlier.
  const opened = ordered.filter((d) => dayOf(d).slice(0, 7) <= todayDay.slice(0, 7))

  // Before the first month the schedule has not started; show month one.
  const current = opened[opened.length - 1] ?? ordered[0]

  const pendingCount = opened.filter(
    (d) => d.installmentNo < current.installmentNo && short(d)
  ).length

  const outstanding = opened.reduce(
    (sum, d) => sum + Math.max(0, d.amountDue - d.amountPaid),
    0
  )
  const paidToDate = ordered.reduce((sum, d) => sum + d.amountPaid, 0)
  const overdue = opened.some((d) => short(d) && dayOf(d) < todayDay)

  // Paid up and money already against a later month reads as "advance".
  const paidAhead = ordered.some(
    (d) => d.installmentNo > current.installmentNo && d.amountPaid > 0
  )
  const base = statusFor(current)
  const status: DueStatus = base === "paid" && paidAhead ? "advance" : base

  return {
    current,
    status,
    pendingCount,
    outstanding,
    paidToDate,
    overdue,
    started: opened.length > 0,
  }
}
