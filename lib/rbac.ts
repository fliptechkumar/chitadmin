/**
 * Central authorization policy. Every access decision in the app resolves to a
 * function in this file, so the rules can be read in one place rather than
 * being rediscovered across route handlers.
 *
 * Edge-safe: no Prisma or Node imports, so middleware can apply the same route
 * table that the server components and API handlers rely on.
 */

import type { Role } from "./roles"

/** The subset of a user that authorization decisions depend on. */
export type Principal = {
  id: number
  role: Role
  branches: string[]
}

// ---------------------------------------------------------------------------
// Route table
// ---------------------------------------------------------------------------

type RouteRule = { prefix: string; roles: readonly Role[] }

/**
 * Which roles may reach which path prefixes. Order does not matter — the most
 * specific (longest) matching prefix wins, so `/home/settings` can be narrower
 * than `/home` without the two fighting.
 */
const ROUTE_RULES: readonly RouteRule[] = [
  // Super-admin-only areas.
  { prefix: "/home/settings", roles: ["SUPER_ADMIN"] },
  { prefix: "/home/chit-interval", roles: ["SUPER_ADMIN"] },

  // Shared admin areas — Chit Admins see a branch-filtered view.
  { prefix: "/home/applicants", roles: ["SUPER_ADMIN", "CHIT_ADMIN"] },
  { prefix: "/home/dues", roles: ["SUPER_ADMIN", "CHIT_ADMIN"] },
  { prefix: "/home/auctions", roles: ["SUPER_ADMIN", "CHIT_ADMIN"] },
  { prefix: "/home", roles: ["SUPER_ADMIN", "CHIT_ADMIN"] },

  // Self-service.
  { prefix: "/account", roles: ["SUPER_ADMIN", "CHIT_ADMIN", "USER"] },

  // API surface.
  { prefix: "/api/settings", roles: ["SUPER_ADMIN"] },
  { prefix: "/api/chit-intervals", roles: ["SUPER_ADMIN"] },
  { prefix: "/api/users", roles: ["SUPER_ADMIN", "CHIT_ADMIN"] },
  { prefix: "/api/groups", roles: ["SUPER_ADMIN", "CHIT_ADMIN"] },
  { prefix: "/api/applicants", roles: ["SUPER_ADMIN", "CHIT_ADMIN"] },
  { prefix: "/api/dues", roles: ["SUPER_ADMIN", "CHIT_ADMIN"] },
  { prefix: "/api/auctions", roles: ["SUPER_ADMIN", "CHIT_ADMIN"] },
  { prefix: "/api/employees", roles: ["SUPER_ADMIN", "CHIT_ADMIN"] },
  { prefix: "/api/collections", roles: ["SUPER_ADMIN", "CHIT_ADMIN"] },
  { prefix: "/api/reports", roles: ["SUPER_ADMIN", "CHIT_ADMIN"] },
  { prefix: "/api/collection-records", roles: ["SUPER_ADMIN", "CHIT_ADMIN"] },
]

/**
 * Paths reachable without a session. Everything else requires one.
 * "/" only ever matches the landing page itself — no other path starts with "//".
 */
const PUBLIC_PREFIXES = [
  "/",
  "/login",
  "/api/auth/login",
  // Clears a dead cookie. Must bypass the gate, or the stale cookie it exists
  // to remove would send it somewhere else first.
  "/api/auth/signed-out",
  "/api/health",
] as const

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function matchRule(pathname: string): RouteRule | null {
  let best: RouteRule | null = null
  for (const rule of ROUTE_RULES) {
    const hit = pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)
    if (hit && (!best || rule.prefix.length > best.prefix.length)) {
      best = rule
    }
  }
  return best
}

/**
 * Whether `role` may load `pathname`. Paths with no rule (the marketing page,
 * say) are allowed once authenticated — the rules restrict, they do not enumerate.
 */
export function canAccessPath(role: Role, pathname: string): boolean {
  const rule = matchRule(pathname)
  if (!rule) return true
  return rule.roles.includes(role)
}

// ---------------------------------------------------------------------------
// Branch scoping
// ---------------------------------------------------------------------------

/**
 * A Prisma `where` fragment limiting rows to the branches a principal may see.
 * Super Admins get `{}` (everything). Chit Admins get their assigned branches.
 * A Chit Admin with no branches assigned matches nothing, which is the safe
 * reading of "assigned to them".
 *
 * @param field the branch column on the model being queried — `branchName` on
 *   ChitGroup, `branch` on Employee.
 */
export function branchScope(
  principal: Principal,
  field: string
): Record<string, unknown> {
  if (principal.role === "SUPER_ADMIN") return {}
  return { [field]: { in: principal.branches } }
}

/** Whether a principal may read or write a row belonging to `branch`. */
export function canAccessBranch(principal: Principal, branch: string): boolean {
  if (principal.role === "SUPER_ADMIN") return true
  if (principal.role === "CHIT_ADMIN") return principal.branches.includes(branch)
  return false
}

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

/** Roles a principal is allowed to create or assign to someone else. */
export function assignableRoles(principal: Principal): Role[] {
  if (principal.role === "SUPER_ADMIN") return ["SUPER_ADMIN", "CHIT_ADMIN", "USER"]
  if (principal.role === "CHIT_ADMIN") return ["USER"]
  return []
}

export type ManageDenial = string | null

/**
 * Whether `principal` may create or modify a user with the given role and
 * branch assignment. Returns null when allowed, or a reason when not.
 */
export function canManageUser(
  principal: Principal,
  target: { id?: number; role: Role; branches: string[] }
): ManageDenial {
  if (principal.role === "SUPER_ADMIN") {
    // A Super Admin must not strip their own admin rights and lock themselves out.
    if (target.id === principal.id && target.role !== "SUPER_ADMIN") {
      return "You cannot change your own role."
    }
    return null
  }

  if (principal.role !== "CHIT_ADMIN") {
    return "You do not have permission to manage users."
  }

  if (target.role !== "USER") {
    return "Chit Admins can only manage users with the User role."
  }

  const outside = target.branches.filter((b) => !principal.branches.includes(b))
  if (outside.length > 0) {
    return `You are not assigned to: ${outside.join(", ")}.`
  }

  return null
}

/** A Prisma `where` fragment limiting which user rows a principal may list. */
export function userListScope(principal: Principal): Record<string, unknown> {
  if (principal.role === "SUPER_ADMIN") return {}
  if (principal.role === "CHIT_ADMIN") {
    // Their own USER accounts: role USER, overlapping at least one branch.
    return {
      role: "USER",
      branches: { hasSome: principal.branches },
    }
  }
  return { id: principal.id }
}
