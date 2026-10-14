/**
 * Validation for recording a collection. Kept free of server imports so the
 * same rules can run in the mobile client before it hits the network, and in
 * the web app if the collections screen is wired up later.
 */

export const COLLECTION_MODES = ["cash", "online", "cheque"] as const
export const COLLECTION_STATUSES = ["paid", "pending", "overdue"] as const

export type CollectionMode = (typeof COLLECTION_MODES)[number]
export type CollectionStatus = (typeof COLLECTION_STATUSES)[number]

export type CollectionInput = {
  customerId: number
  group: string
  installment: number
  amount: number
  mode: CollectionMode
  penalty: number
  status: CollectionStatus
}

export type CollectionErrors = Partial<Record<keyof CollectionInput, string>>

type ParseResult =
  | { ok: true; data: CollectionInput }
  | { ok: false; errors: CollectionErrors }

/** Guards against a typo adding a crore to someone's receipt. */
const MAX_AMOUNT = 10_000_000

export function parseCollectionInput(raw: unknown): ParseResult {
  const body = (raw ?? {}) as Record<string, unknown>
  const errors: CollectionErrors = {}

  const customerId = Number(body.customerId)
  if (!Number.isInteger(customerId) || customerId < 1) {
    errors.customerId = "Select a customer"
  }

  const group = typeof body.group === "string" ? body.group.trim() : ""
  if (!group) errors.group = "Group is required"

  const installment = Number(body.installment)
  if (!Number.isInteger(installment) || installment < 1 || installment > 500) {
    errors.installment = "Installment must be a whole number of at least 1"
  }

  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 1) {
    errors.amount = "Amount must be a whole number of at least ₹1"
  } else if (amount > MAX_AMOUNT) {
    errors.amount = "Amount looks too large — check the value"
  }

  // Penalty is optional and defaults to zero.
  const rawPenalty = body.penalty === undefined || body.penalty === null ? 0 : Number(body.penalty)
  const penalty = rawPenalty
  if (!Number.isInteger(penalty) || penalty < 0 || penalty > MAX_AMOUNT) {
    errors.penalty = "Penalty must be zero or a positive whole number"
  }

  const mode = body.mode as CollectionMode
  if (!COLLECTION_MODES.includes(mode)) errors.mode = "Select a payment mode"

  // Recording a payment defaults to paid; the other states are for corrections.
  const status = (body.status ?? "paid") as CollectionStatus
  if (!COLLECTION_STATUSES.includes(status)) errors.status = "Unknown status"

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    data: { customerId, group, installment, amount, mode, penalty, status },
  }
}
