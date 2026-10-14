import "server-only"

import { createHash, randomBytes } from "node:crypto"

import { prisma } from "@/lib/prisma"
import type { Role } from "@/lib/roles"
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  signAccessToken,
} from "@/lib/session"

/**
 * Mobile token lifecycle.
 *
 * The access token is a short JWT; the refresh token is opaque random bytes
 * stored only as a SHA-256 hash. Hashing means a database leak does not hand
 * over working sessions. SHA-256 rather than bcrypt is deliberate: the token is
 * 256 bits of entropy, so there is nothing to brute-force, and refresh happens
 * on a hot path.
 */

export type TokenPair = {
  accessToken: string
  refreshToken: string
  tokenType: "Bearer"
  expiresIn: number
  refreshExpiresIn: number
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

function newRefreshToken(): string {
  return randomBytes(32).toString("base64url")
}

type SessionMeta = { userAgent?: string | null; ip?: string | null }

async function issuePair(
  sessionId: string,
  user: { id: number; role: Role }
): Promise<TokenPair> {
  const refreshToken = newRefreshToken()
  const now = Date.now()

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      refreshTokenHash: hashToken(refreshToken),
      refreshExpiresAt: new Date(now + REFRESH_TOKEN_TTL_SECONDS * 1000),
      expiresAt: new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000),
      lastUsedAt: new Date(),
    },
  })

  const accessToken = await signAccessToken({
    userId: user.id,
    sessionId,
    role: user.role,
  })

  return {
    accessToken,
    refreshToken,
    tokenType: "Bearer",
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
  }
}

/** Starts a mobile session and returns its first token pair. */
export async function createMobileSession(
  user: { id: number; role: Role },
  meta: SessionMeta = {}
): Promise<TokenPair> {
  const sessionId = crypto.randomUUID()

  await prisma.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      kind: "mobile",
      // Overwritten by issuePair; set here to satisfy the non-null column.
      expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000),
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
      ip: meta.ip ?? null,
    },
  })

  return issuePair(sessionId, user)
}

export type RefreshResult =
  | { ok: true; tokens: TokenPair }
  | { ok: false; reason: "invalid" | "expired" | "disabled" }

/**
 * Exchanges a refresh token for a new pair, rotating the refresh token so the
 * presented one stops working. A stolen token is therefore usable at most once,
 * and the theft surfaces when the real device's next refresh fails.
 */
export async function rotateRefreshToken(
  refreshToken: string
): Promise<RefreshResult> {
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hashToken(refreshToken) },
    include: { user: { select: { id: true, role: true, isActive: true } } },
  })

  if (!session || session.kind !== "mobile") return { ok: false, reason: "invalid" }

  if (!session.refreshExpiresAt || session.refreshExpiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return { ok: false, reason: "expired" }
  }

  if (!session.user.isActive) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return { ok: false, reason: "disabled" }
  }

  return {
    ok: true,
    tokens: await issuePair(session.id, {
      id: session.user.id,
      role: session.user.role as Role,
    }),
  }
}

/** Ends a mobile session. Returns false when the token was already unknown. */
export async function revokeRefreshToken(refreshToken: string): Promise<boolean> {
  const { count } = await prisma.session.deleteMany({
    where: { refreshTokenHash: hashToken(refreshToken) },
  })
  return count > 0
}
