import type { ChitGroup } from "./mock-data"

/**
 * What a group is created or edited with. `members` and `vacants` are not
 * here: they are counted off the roster, so typing them in could only ever
 * disagree with the seats the group actually has.
 */
export type GroupInput = Omit<ChitGroup, "id" | "members" | "vacants">
export type GroupErrors = Partial<Record<keyof GroupInput | "id", string>>

export const GROUP_STATUSES: ChitGroup["status"][] = [
  "active",
  "completed",
  "upcoming",
]

export const SPECIAL_TYPES = ["Regular", "Special", "Premium"]

/**
 * The chit plans a group can run, named as the source system names them:
 * "<chit value>-<bid ceiling %>", with the odd short plan spelling out its
 * months. Picked from a list rather than typed so the register never carries
 * two spellings of the same plan.
 */
export const PERCENTAGE_OPTIONS = [
  "50K-25",
  "20L-25",
  "10L-25",
  "5L-25",
  "3L-25",
  "2L-25",
  "1L-25",
  "1L-15-10M",
]

// Dates are kept as dd/MM/yyyy strings to match the existing seed data.
const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/

/** "2026-03-21" (native date input) -> "21/03/2026" */
export function toDisplayDate(isoDate: string) {
  if (!isoDate) return ""
  const [y, m, d] = isoDate.split("-")
  return `${d}/${m}/${y}`
}

/** "21/03/2026" -> "2026-03-21" (native date input) */
export function toInputDate(displayDate: string) {
  if (!DATE_RE.test(displayDate)) return ""
  const [d, m, y] = displayDate.split("/")
  return `${y}-${m}-${d}`
}

function toTimestamp(displayDate: string) {
  const [d, m, y] = displayDate.split("/").map(Number)
  return new Date(y, m - 1, d).getTime()
}

type ParseResult =
  | { ok: true; data: GroupInput }
  | { ok: false; errors: GroupErrors }

/**
 * Validates a raw group payload from either the modal form or an API client.
 * Shared by both so the browser and the route handler agree on the rules.
 */
export function parseGroupInput(raw: unknown): ParseResult {
  const errors: GroupErrors = {}
  const body = (raw ?? {}) as Record<string, unknown>

  const text = (key: keyof GroupInput, label: string) => {
    const value = typeof body[key] === "string" ? (body[key] as string).trim() : ""
    if (!value) errors[key] = `${label} is required`
    return value
  }

  const count = (key: keyof GroupInput, label: string, min: number) => {
    const value = Number(body[key])
    if (body[key] === "" || body[key] === null || body[key] === undefined) {
      errors[key] = `${label} is required`
    } else if (!Number.isFinite(value) || !Number.isInteger(value) || value < min) {
      errors[key] = `${label} must be a whole number ≥ ${min}`
    }
    return value
  }

  const date = (key: "startDate" | "endDate", label: string) => {
    const value = typeof body[key] === "string" ? (body[key] as string).trim() : ""
    if (!value) errors[key] = `${label} is required`
    else if (!DATE_RE.test(value)) errors[key] = `${label} must be dd/mm/yyyy`
    return value
  }

  const branchName = text("branchName", "Branch")
  const specialType = text("specialType", "Type")
  const group = text("group", "Group name")
  const percentage = text("percentage", "Percentage")
  if (!errors.percentage && !PERCENTAGE_OPTIONS.includes(percentage)) {
    errors.percentage = "Select a percentage from the list"
  }
  const amount = count("amount", "Amount", 1)
  const startDate = date("startDate", "Start date")
  const endDate = date("endDate", "End date")
  // Seat 1 is the foreman's own and never assignable, so a group needs at
  // least two seats before anyone can be a member of it.
  const totalTickets = count("totalTickets", "Seats", 2)

  const status = body.status as ChitGroup["status"]
  if (!GROUP_STATUSES.includes(status)) errors.status = "Select a status"

  if (!errors.startDate && !errors.endDate && toTimestamp(endDate) <= toTimestamp(startDate)) {
    errors.endDate = "End date must be after the start date"
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    data: {
      branchName,
      specialType,
      group,
      percentage,
      amount,
      startDate,
      endDate,
      totalTickets,
      status,
    },
  }
}
