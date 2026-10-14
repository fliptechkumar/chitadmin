import { isRole, type Role } from "./roles"
import { validatePassword } from "./password-rules"

export type UserErrors = Record<string, string>

export type UserCreateInput = {
  username: string
  email: string
  name: string
  password: string
  role: Role
  branches: string[]
  isActive: boolean
}

export type UserUpdateInput = {
  email: string
  name: string
  role: Role
  branches: string[]
  isActive: boolean
  /** Empty string means "leave the existing password alone". */
  password: string
}

type Parsed<T> = { ok: true; data: T } | { ok: false; errors: UserErrors }

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function readString(body: Record<string, unknown>, key: string): string {
  return typeof body[key] === "string" ? (body[key] as string).trim() : ""
}

function readBranches(body: Record<string, unknown>): string[] {
  if (!Array.isArray(body.branches)) return []
  // De-duplicate and drop blanks so the stored scope is clean.
  const cleaned = body.branches
    .filter((b): b is string => typeof b === "string")
    .map((b) => b.trim())
    .filter(Boolean)
  return [...new Set(cleaned)]
}

/** Rules shared by create and update. Mutates `errors`. */
function validateShared(
  errors: UserErrors,
  fields: { email: string; name: string; role: string; branches: string[] }
) {
  if (!fields.name) errors.name = "Full name is required"
  else if (fields.name.length > 120) errors.name = "Name must be at most 120 characters"

  if (!fields.email) errors.email = "Email is required"
  else if (!EMAIL_RE.test(fields.email)) errors.email = "Enter a valid email address"

  if (!isRole(fields.role)) {
    errors.role = "Select a role"
  } else if (fields.role !== "SUPER_ADMIN" && fields.branches.length === 0) {
    // A Chit Admin with no branches could see nothing. A User with no branches
    // falls outside every Chit Admin's scope (see userListScope), so nobody but
    // a Super Admin could ever manage them again.
    errors.branches =
      fields.role === "CHIT_ADMIN"
        ? "Assign at least one branch to a Chit Admin"
        : "Assign at least one branch so a Chit Admin can manage this user"
  }
}

/**
 * Super Admins are unscoped, so their branch list is always empty; every other
 * role keeps what was submitted. Dropping branches for a role that needs them
 * would silently widen or orphan access instead of failing the request.
 */
function branchesForRole(role: string, branches: string[]): string[] {
  return role === "SUPER_ADMIN" ? [] : branches
}

export function parseUserCreate(raw: unknown): Parsed<UserCreateInput> {
  const body = (raw ?? {}) as Record<string, unknown>
  const errors: UserErrors = {}

  const username = readString(body, "username").toLowerCase()
  const email = readString(body, "email").toLowerCase()
  const name = readString(body, "name")
  const password = typeof body.password === "string" ? body.password : ""
  const role = readString(body, "role")
  const branches = readBranches(body)

  if (!username) errors.username = "Username is required"
  else if (!USERNAME_RE.test(username)) {
    errors.username =
      "Username must be 3-32 characters, lowercase letters, numbers, dot, dash or underscore"
  }

  const passwordProblem = validatePassword(password)
  if (passwordProblem) errors.password = passwordProblem

  validateShared(errors, { email, name, role, branches })

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    data: {
      username,
      email,
      name,
      password,
      role: role as Role,
      branches: branchesForRole(role, branches),
      isActive: body.isActive !== false,
    },
  }
}

export function parseUserUpdate(raw: unknown): Parsed<UserUpdateInput> {
  const body = (raw ?? {}) as Record<string, unknown>
  const errors: UserErrors = {}

  const email = readString(body, "email").toLowerCase()
  const name = readString(body, "name")
  const role = readString(body, "role")
  const branches = readBranches(body)
  const password = typeof body.password === "string" ? body.password : ""

  // Blank password means "unchanged"; a supplied one still has to be strong.
  if (password) {
    const passwordProblem = validatePassword(password)
    if (passwordProblem) errors.password = passwordProblem
  }

  validateShared(errors, { email, name, role, branches })

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    data: {
      email,
      name,
      role: role as Role,
      branches: branchesForRole(role, branches),
      isActive: body.isActive !== false,
      password,
    },
  }
}
