/**
 * Role vocabulary, kept free of any Prisma or Node imports so that middleware
 * (which runs on the edge runtime) can import it alongside server code.
 * Mirrors the `UserRole` enum in prisma/schema.prisma.
 */

export const ROLES = ["SUPER_ADMIN", "CHIT_ADMIN", "USER"] as const

export type Role = (typeof ROLES)[number]

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  CHIT_ADMIN: "Chit Admin",
  USER: "User",
}

/** Landing route for a role — used after login and to bounce misrouted users. */
export function homeFor(role: Role): string {
  return role === "USER" ? "/account" : "/home"
}
