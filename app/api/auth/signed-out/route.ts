import { NextResponse } from "next/server"

import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session"

/**
 * Clears a session cookie that no longer resolves, then sends the user to sign
 * in again.
 *
 * Middleware only checks the token's signature — it runs on the edge and
 * cannot reach the database — so a cookie whose session has been revoked still
 * looks valid to it. Without somewhere to drop that cookie, a page guard
 * redirecting to /login gets bounced straight back by middleware, and the two
 * layers loop until the browser gives up with ERR_TOO_MANY_REDIRECTS.
 *
 * Server Components cannot delete cookies while rendering, which is why this
 * is a route handler rather than something requireUser does inline.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = url.searchParams.get("next")

  const target = new URL("/login", url.origin)
  // Same-site paths only — an absolute URL here would be an open redirect.
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    target.searchParams.set("next", next)
  }

  const response = NextResponse.redirect(target)
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0))
  return response
}
