/**
 * Server-side session resolution and guards.
 *
 * A request is authenticated only if its cookie carries a validly signed token
 * AND the matching Session row still exists, has not expired, and belongs to an
 * active user. Middleware checks the signature alone (it cannot reach the
 * database); this module is the authority.
 */

import "server-only"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"
import { NextResponse } from "next/server"

import { prisma } from "./prisma"
import { homeFor, type Role } from "./roles"
import { canAccessBranch, type Principal } from "./rbac"
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
  signSessionToken,
  verifySessionToken,
} from "./session"

export type CurrentUser = Principal & {
  username: string
  name: string
  email: string
  sessionId: string
}

/**
 * The signed-in user, or null. Memoised per request so a layout, a page and a
 * server action in the same render share one database round-trip.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies()
  const claims = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)
  if (!claims) return null

  const session = await prisma.session.findUnique({
    where: { id: claims.sessionId },
    include: { user: true },
  })

  // Revoked (logged out), expired, or the account was disabled since sign-in.
  if (!session || session.expiresAt < new Date()) return null
  if (session.userId !== claims.userId) return null
  if (!session.user.isActive) return null

  return {
    id: session.user.id,
    username: session.user.username,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role as Role,
    branches: session.user.branches,
    sessionId: session.id,
  }
})

// ---------------------------------------------------------------------------
// Page guards — these redirect, so they belong in server components/layouts
// ---------------------------------------------------------------------------

/** The signed-in user, or a redirect to sign in. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (user) return user

  // A cookie that no longer resolves — revoked session, disabled account —
  // still passes middleware's signature check, so sending it straight to
  // /login would just be bounced back here. Clear it on the way out instead.
  const cookieStore = await cookies()
  if (cookieStore.get(SESSION_COOKIE)) {
    // proxy.ts forwards the path so the user returns here after signing in.
    const pathname = (await headers()).get("x-pathname")
    redirect(
      pathname
        ? `/api/auth/signed-out?next=${encodeURIComponent(pathname)}`
        : "/api/auth/signed-out"
    )
  }

  redirect("/login")
}

/**
 * The signed-in user when their role is allowed here; otherwise a redirect to
 * the landing page for their own role, so a User typing /home/settings lands
 * somewhere sensible rather than on an error.
 */
export async function requireRole(allowed: readonly Role[]): Promise<CurrentUser> {
  const user = await requireUser()
  if (!allowed.includes(user.role)) redirect(homeFor(user.role))
  return user
}

// ---------------------------------------------------------------------------
// API guards — these return a response instead of redirecting
// ---------------------------------------------------------------------------

export type ApiAuth =
  | { ok: true; user: CurrentUser }
  | { ok: false; response: NextResponse }

function deny(status: number, message: string): ApiAuth {
  return { ok: false, response: NextResponse.json({ error: message }, { status }) }
}

/** Authenticate an API request, optionally restricting it to certain roles. */
export async function authorizeApi(allowed?: readonly Role[]): Promise<ApiAuth> {
  const user = await getCurrentUser()
  if (!user) return deny(401, "Authentication required.")
  if (allowed && !allowed.includes(user.role)) {
    return deny(403, "You do not have permission to perform this action.")
  }
  return { ok: true, user }
}

/** 403 response for a row outside the caller's branch scope, or null if allowed. */
export function denyOutsideBranch(
  user: CurrentUser,
  branch: string
): NextResponse | null {
  if (canAccessBranch(user, branch)) return null
  return NextResponse.json(
    { error: `You are not assigned to the ${branch} branch.` },
    { status: 403 }
  )
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

/** Creates a session row and writes the signed cookie onto `response`. */
export async function startSession(
  response: NextResponse,
  user: { id: number; role: Role },
  meta: { userAgent?: string | null; ip?: string | null } = {}
): Promise<void> {
  const sessionId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000)

  await prisma.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
      ip: meta.ip ?? null,
    },
  })

  const token = await signSessionToken({
    userId: user.id,
    sessionId,
    role: user.role,
  })

  response.cookies.set(
    SESSION_COOKIE,
    token,
    sessionCookieOptions(SESSION_MAX_AGE_SECONDS)
  )
}

/** Deletes the session row and clears the cookie. */
export async function endSession(
  response: NextResponse,
  sessionId: string
): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } })
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0))
}

/** Drops every session for a user — used when disabling or demoting an account. */
export async function revokeAllSessions(userId: number): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } })
}

/**
 * Drops every session but the one making the request. Used when a user changes
 * their own password: anyone else holding a stolen session is cut off, while
 * the person doing it stays signed in where they are.
 */
export async function revokeOtherSessions(
  userId: number,
  keepSessionId: string
): Promise<number> {
  const { count } = await prisma.session.deleteMany({
    where: { userId, id: { not: keepSessionId } },
  })
  return count
}
