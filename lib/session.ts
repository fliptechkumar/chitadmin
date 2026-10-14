/**
 * Session token encoding. Edge-safe: `jose` and Web Crypto only, so middleware
 * can verify a token without touching the database.
 *
 * The token is a signed JWT carrying the session row id (`sid`). Signature
 * verification alone proves the token was issued by us and has not expired;
 * confirming the session still exists (i.e. the user has not logged out) is a
 * database read and lives in lib/auth-server.ts.
 */

import { SignJWT, jwtVerify } from "jose"

import { isRole, type Role } from "./roles"

export const SESSION_COOKIE = "chit_session"
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8 // 8 hours

export type SessionClaims = {
  userId: number
  sessionId: string
  role: Role
}

let cachedKey: Uint8Array | null = null

function secretKey(): Uint8Array {
  if (cachedKey) return cachedKey

  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short (need at least 32 characters). " +
        "Generate one with: openssl rand -base64 32"
    )
  }

  cachedKey = new TextEncoder().encode(secret)
  return cachedKey
}

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ role: claims.role, sid: claims.sessionId, typ: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(claims.userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey())
}

/** Returns the claims for a structurally valid, unexpired token, else null. */
export async function verifySessionToken(
  token: string | undefined
): Promise<SessionClaims | null> {
  if (!token) return null

  // Resolved outside the try so a misconfigured AUTH_SECRET surfaces as an
  // error rather than silently logging everybody out.
  const key = secretKey()

  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] })

    const userId = Number(payload.sub)
    const sessionId = payload.sid
    const role = payload.role

    // A mobile access token must not be replayable as a browser cookie.
    // Tokens minted before `typ` existed carry none, so only "access" is refused.
    if (payload.typ === "access") return null

    if (!Number.isInteger(userId) || typeof sessionId !== "string" || !isRole(role)) {
      return null
    }

    return { userId, sessionId, role }
  } catch {
    // Bad signature, expired, or malformed — all mean "not signed in".
    return null
  }
}

// ---------------------------------------------------------------------------
// Mobile access tokens
// ---------------------------------------------------------------------------

/**
 * Short, because a stolen access token cannot be revoked before it expires —
 * only the refresh token can be taken away. The client refreshes silently.
 */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60 // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days

/**
 * Access tokens carry `typ: "access"` so a token minted for one purpose cannot
 * be presented for another. Cookie tokens have no `typ` and are rejected here.
 */
export async function signAccessToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ role: claims.role, sid: claims.sessionId, typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(claims.userId))
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey())
}

export type AccessTokenResult =
  | { status: "valid"; claims: SessionClaims }
  | { status: "expired" }
  | { status: "invalid" }

/**
 * Distinguishes expiry from invalidity: the client should refresh on the first
 * and re-authenticate on the second, and cannot tell them apart from a 401.
 */
export async function verifyAccessToken(
  token: string | undefined
): Promise<AccessTokenResult> {
  if (!token) return { status: "invalid" }

  const key = secretKey()

  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] })

    const userId = Number(payload.sub)
    const sessionId = payload.sid
    const role = payload.role

    if (
      payload.typ !== "access" ||
      !Number.isInteger(userId) ||
      typeof sessionId !== "string" ||
      !isRole(role)
    ) {
      return { status: "invalid" }
    }

    return { status: "valid", claims: { userId, sessionId, role } }
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === "ERR_JWT_EXPIRED") return { status: "expired" }
    return { status: "invalid" }
  }
}

/** Cookie attributes shared by the login and logout routes. */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }
}
