/**
 * Chit interval: a scheme's month-by-month collection schedule.
 *
 * How the numbers relate (from the branch's printed schedules, e.g. the
 * ₹5,00,000 × 20 card):
 *
 *   share       = chit value ÷ months                    ₹25,000
 *   instalment  = what each member pays that month        ₹18,750 … ₹25,000
 *   kasar       = share − instalment (member's dividend)  ₹6,250 … ₹0
 *   payout      = what that month's prize winner takes    ₹3,50,000 …
 *
 * Month 1 is usually collected in full and pays no prize ("for registration").
 * The total a member pays over the chit is the sum of instalments — ₹4,30,750
 * on that card — not the chit value. Printed schedules are fixed in advance and
 * do not always follow a formula, so every month is stored as configured.
 *
 * Months carry no dates here: each group collects from its own start date,
 * so the schedule is by month number only.
 *
 * Free of server imports so the editor validates with the API's rules.
 */

export const INTERVAL_STATUSES = ["active", "inactive"] as const
export type IntervalStatus = (typeof INTERVAL_STATUSES)[number]

/** Foreman's commission the branch deducts from each prize, as a %. */
export const DEFAULT_COMMISSION_PCT = 5

export type IntervalMonth = {
  monthNo: number
  installment: number
  /** Null when the month pays no prize (registration). */
  payout: number | null
}

export type ChitIntervalConfig = {
  id: number | null
  scheme: string
  chitValue: number
  months: number
  status: IntervalStatus
  notes: string
  rows: IntervalMonth[]
  updatedAt: string | null
  updatedBy: string | null
}

/** A plan as the groups register knows it, for the scheme picker. */
export type SchemeOption = {
  scheme: string
  chitValue: number
  /** Most common duration among the scheme's groups. */
  months: number
  groups: number
  /** Durations that already have a saved schedule. */
  configured: number[]
}

export const shareOf = (chitValue: number, months: number) =>
  months > 0 ? Math.round(chitValue / months) : 0

/** A fresh schedule: every month at the full share, month 1 for registration. */
export function blankRows(chitValue: number, months: number): IntervalMonth[] {
  const share = shareOf(chitValue, months)
  return Array.from({ length: months }, (_, i) => ({
    monthNo: i + 1,
    installment: share,
    payout: i === 0 ? null : chitValue,
  }))
}

/**
 * The kasar a payout implies: what is left of the chit value after the prize
 * and the foreman's commission, shared between the members.
 */
export function kasarFromPayout(
  chitValue: number,
  months: number,
  payout: number,
  commissionPct = DEFAULT_COMMISSION_PCT
) {
  const commission = Math.round((chitValue * commissionPct) / 100)
  return Math.max(0, Math.round((chitValue - payout - commission) / months))
}

/** Running totals for one member across the schedule. */
export function withTotals(rows: IntervalMonth[], chitValue: number, months: number) {
  const share = shareOf(chitValue, months)
  const payable = rows.reduce((s, r) => s + r.installment, 0)
  let paid = 0
  return {
    payable,
    kasarTotal: rows.reduce((s, r) => s + Math.max(0, share - r.installment), 0),
    rows: rows.map((r) => {
      paid += r.installment
      return {
        ...r,
        kasar: share - r.installment,
        cumulative: paid,
        remaining: payable - paid,
      }
    }),
  }
}

export type IntervalErrors = {
  form: Partial<Record<"scheme" | "chitValue" | "months" | "status", string>>
  rows: Record<number, Partial<Record<"installment" | "payout", string>>>
}

export type IntervalInput = Omit<ChitIntervalConfig, "id" | "updatedAt" | "updatedBy">

export function parseInterval(
  raw: unknown
): { ok: true; data: IntervalInput } | { ok: false; errors: IntervalErrors } {
  const body = (raw ?? {}) as Record<string, unknown>
  const errors: IntervalErrors = { form: {}, rows: {} }

  const scheme = typeof body.scheme === "string" ? body.scheme.trim() : ""
  if (!scheme) errors.form.scheme = "Select a chit scheme"

  const chitValue = Number(body.chitValue)
  if (!Number.isInteger(chitValue) || chitValue < 1000 || chitValue > 100_000_000) {
    errors.form.chitValue = "Chit amount must be a whole number of at least ₹1,000"
  }

  const months = Number(body.months)
  if (!Number.isInteger(months) || months < 2 || months > 120) {
    errors.form.months = "Duration must be between 2 and 120 months"
  }

  const status = body.status as IntervalStatus
  if (!INTERVAL_STATUSES.includes(status)) errors.form.status = "Choose active or inactive"

  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : ""

  const share = shareOf(chitValue, months)
  const list = Array.isArray(body.rows) ? (body.rows as Record<string, unknown>[]) : []
  const rows: IntervalMonth[] = []

  if (!errors.form.months && list.length !== months) {
    errors.form.months = `The schedule needs exactly ${months} months`
  }

  list.forEach((item, i) => {
    const monthNo = i + 1
    const rowErrors: IntervalErrors["rows"][number] = {}

    const installment = Number(item?.installment)
    if (!Number.isInteger(installment) || installment < 1) {
      rowErrors.installment = "Enter a whole amount"
    } else if (share && installment > share) {
      rowErrors.installment = `Cannot exceed the share of ₹${share.toLocaleString("en-IN")}`
    }

    const rawPayout = item?.payout
    const payout = rawPayout === null || rawPayout === undefined || rawPayout === "" ? null : Number(rawPayout)
    if (payout !== null && (!Number.isInteger(payout) || payout < 1)) {
      rowErrors.payout = "Whole amount, or leave blank"
    } else if (payout !== null && chitValue && payout > chitValue) {
      rowErrors.payout = "Cannot exceed the chit amount"
    }

    if (Object.keys(rowErrors).length) errors.rows[monthNo] = rowErrors
    rows.push({ monthNo, installment, payout })
  })

  if (Object.keys(errors.form).length || Object.keys(errors.rows).length) {
    return { ok: false, errors }
  }

  return { ok: true, data: { scheme, chitValue, months, status, notes, rows } }
}
