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
  /** Instalments already past their date and not settled. */
  pendingCount: number
  /** Total still owed across every unpaid instalment to date. */
  outstanding: number
  paidToDate: number
}

/**
 * Reduces a member's whole schedule to the row the register shows.
 *
 * "Current" is the instalment being collected right now — the latest one whose
 * date has passed — so every member of a group is shown against the same month.
 * Picking their oldest unpaid instead would leave anyone with old arrears stuck
 * displaying a stale month, and the column would no longer line up down the page.
 *
 * Arrears are reported separately as `pendingCount`, which is what the status
 * column cannot express on its own.
 */
export function positionFor(dues: DueRow[], today = new Date()): DuesPosition {
  const ordered = [...dues].sort((a, b) => a.installmentNo - b.installmentNo)
  if (ordered.length === 0) {
    return { current: null, status: "paid", pendingCount: 0, outstanding: 0, paidToDate: 0 }
  }

  const elapsed = ordered.filter((d) => new Date(d.dueDate) <= today)

  // Before the first due date the schedule has not started; show month one.
  const current = elapsed[elapsed.length - 1] ?? ordered[0]

  // Earlier months still short — the current one is reported by `status`.
  const pendingCount = elapsed.filter(
    (d) => d.installmentNo < current.installmentNo && d.amountPaid < d.amountDue
  ).length

  const outstanding = elapsed.reduce(
    (sum, d) => sum + Math.max(0, d.amountDue - d.amountPaid),
    0
  )
  const paidToDate = ordered.reduce((sum, d) => sum + d.amountPaid, 0)

  // Paid up and money already against a later month reads as "advance".
  const paidAhead = ordered.some(
    (d) => d.installmentNo > current.installmentNo && d.amountPaid > 0
  )
  const base = statusFor(current)
  const status: DueStatus = base === "paid" && paidAhead ? "advance" : base

  return { current, status, pendingCount, outstanding, paidToDate }
}
