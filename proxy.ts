/**
 * First line of defence: every request passes through here before a page or
 * route handler runs, so typing an admin URL by hand cannot reach the render.
 *
 * Middleware runs on the edge runtime and cannot query Postgres, so it verifies
 * the token signature only. Handlers and layouts additionally confirm the
 * session row still exists via lib/auth-server.ts — a logged-out token is
 * rejected there, not here.
 */

import { NextResponse, type NextRequest } from "next/server"

import { canAccessPath, isPublicPath } from "@/lib/rbac"
import { homeFor } from "@/lib/roles"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session"

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // The versioned API authenticates with bearer tokens, which carry no cookie.
  // Its handlers enforce auth themselves via lib/api/auth.ts; applying the
  // cookie gate here would reject every mobile request before it ran.
  if (pathname.startsWith("/api/v1")) return NextResponse.next()

  const isApi = pathname.startsWith("/api")
  const claims = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)

  if (isPublicPath(pathname)) {
    // Someone already signed in has no use for the login screen.
    if (claims && pathname === "/login") {
      return NextResponse.redirect(new URL(homeFor(claims.role), request.url))
    }
    return NextResponse.next()
  }

  if (!claims) {
    if (isApi) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }
    const loginUrl = new URL("/login", request.url)
    // Remember where they were headed so login can send them back.
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Server Components cannot read the request URL, so the path is passed on as
  // a header. requireUser uses it to send a forced sign-out back where it began.
  const forwarded = new Headers(request.headers)
  forwarded.set("x-pathname", pathname)

  if (!canAccessPath(claims.role, pathname)) {
    if (isApi) {
      return NextResponse.json(
        { error: "You do not have permission to perform this action." },
        { status: 403 }
      )
    }
    return NextResponse.redirect(new URL(homeFor(claims.role), request.url))
  }

  return NextResponse.next({ request: { headers: forwarded } })
}

export const config = {
  // Everything except Next's internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
}
