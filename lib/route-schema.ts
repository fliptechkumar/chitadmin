/**
 * Validation for collection routes. No server imports, so the settings form and
 * the API handler enforce the same rules.
 */

import { validatePassword } from "@/lib/password-rules"

export type RouteInput = {
  code: string
  name: string
  branch: string
  /** Places the round covers. Free-form and unbounded. */
  areas: string[]
  /** Employee ids, in display order. Unbounded — a route is not capped at two. */
  executiveIds: number[]
  inchargeId: number | null
  notes: string
  isActive: boolean
  /** Mobile-app sign-in for the route. Blank means the route has no login. */
  username: string
  /** Blank keeps the current password; required when a login is first set up. */
  password: string
}

export type RouteErrors = Partial<Record<keyof RouteInput, string>> & {
  /** Whole-record problems: a missing route, or a failed request. */
  id?: string
}

const CODE_RE = /^[A-Z0-9][A-Z0-9-]{0,15}$/
/** Same rule as staff usernames, since both sign in through one table. */
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/

type ParseResult =
  | { ok: true; data: RouteInput }
  | { ok: false; errors: RouteErrors }

/** Drops blanks and duplicates so a stray empty row is not stored. */
function cleanStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const cleaned = value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
  return [...new Set(cleaned)]
}

function cleanIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const ids = value
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0)
  return [...new Set(ids)]
}

/**
 * `hasLogin` says whether the route already has a sign-in, which decides
 * whether a blank password means "keep it" or "missing".
 */
export function parseRouteInput(raw: unknown, hasLogin = false): ParseResult {
  const body = (raw ?? {}) as Record<string, unknown>
  const errors: RouteErrors = {}

  const code =
    typeof body.code === "string" ? body.code.trim().toUpperCase() : ""
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const branch = typeof body.branch === "string" ? body.branch.trim() : ""
  const notes = typeof body.notes === "string" ? body.notes.trim() : ""
  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : ""
  const password = typeof body.password === "string" ? body.password : ""

  const areas = cleanStrings(body.areas)
  const executiveIds = cleanIds(body.executiveIds)

  const rawIncharge = body.inchargeId
  const inchargeId =
    rawIncharge === null || rawIncharge === undefined || rawIncharge === ""
      ? null
      : Number(rawIncharge)

  if (!code) errors.code = "Route code is required"
  else if (!CODE_RE.test(code)) {
    errors.code = "Use up to 16 characters: letters, numbers or dashes"
  }

  if (!name) errors.name = "Route name is required"
  else if (name.length > 80) errors.name = "Route name is too long"

  if (!branch) errors.branch = "Select a branch"

  if (areas.length === 0) errors.areas = "Add at least one area"

  if (inchargeId !== null && !Number.isInteger(inchargeId)) {
    errors.inchargeId = "Select a valid incharge"
  }

  if (notes.length > 500) errors.notes = "Notes must be under 500 characters"

  if (username && !USERNAME_RE.test(username)) {
    errors.username =
      "3–32 characters: lowercase letters, numbers, dot, dash or underscore"
  }
  if (username && !password && !hasLogin) {
    errors.password = "Set a password for the new login"
  } else if (username && password) {
    const problem = validatePassword(password)
    if (problem) errors.password = problem
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    data: {
      code,
      name,
      branch,
      areas,
      executiveIds,
      inchargeId,
      notes,
      isActive: body.isActive !== false,
      username,
      password: username ? password : "",
    },
  }
}
