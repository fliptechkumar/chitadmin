import "server-only"

import type { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import type { Role } from "@/lib/roles"
import type { Principal } from "@/lib/rbac"
import { verifyAccessToken } from "@/lib/session"
import { apiError } from "./response"

/**
 * Bearer authentication for the v1 surface.
 *
 * Same two-layer rule as the web app: the signature proves the token is ours,
 * and the Session row proves it has not been revoked. A token whose session was
 * deleted (logout, or an admin disabling the account) stops working at once,
 * even though the JWT itself is still within its 15-minute life.
 */

export type ApiUser = Principal & {
  username: string
  name: string
  email: string
  sessionId: string
}

export type BearerAuth =
  | { ok: true; user: ApiUser }
  | { ok: false; response: NextResponse }

function bearerToken(request: Request): string | undefined {
  const header = request.headers.get("authorization")
  if (!header) return undefined

  const [scheme, token] = header.split(" ")
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined
  return token.trim()
}

export async function authenticateBearer(
  request: Request,
  allowed?: readonly Role[]
): Promise<BearerAuth> {
  const result = await verifyAccessToken(bearerToken(request))

  if (result.status === "expired") {
    return {
      ok: false,
      response: apiError(
        "TOKEN_EXPIRED",
        "Access token has expired. Use the refresh token to get a new one."
      ),
    }
  }

  if (result.status === "invalid") {
    return {
      ok: false,
      response: apiError("UNAUTHENTICATED", "A valid bearer token is required."),
    }
  }

  const session = await prisma.session.findUnique({
    where: { id: result.claims.sessionId },
    include: { user: true },
  })

  if (
    !session ||
    session.kind !== "mobile" ||
    session.userId !== result.claims.userId ||
    !session.user.isActive
  ) {
    return {
      ok: false,
      response: apiError("UNAUTHENTICATED", "This session is no longer valid."),
    }
  }

  if (allowed && !allowed.includes(session.user.role as Role)) {
    return {
      ok: false,
      response: apiError(
        "FORBIDDEN",
        "Your role does not have access to this resource."
      ),
    }
  }

  // Cheap liveness signal for spotting abandoned devices.
  void prisma.session
    .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {})

  return {
    ok: true,
    user: {
      id: session.user.id,
      username: session.user.username,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role as Role,
      branches: session.user.branches,
      sessionId: session.id,
    },
  }
}
