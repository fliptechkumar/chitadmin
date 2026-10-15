import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { startSession } from "@/lib/auth-server"
import { verifyPassword } from "@/lib/password"
import { homeFor, type Role } from "@/lib/roles"
import { clearFailures, recordFailure, retryAfter } from "@/lib/login-throttle"

/**
 * A bcrypt hash of a value nobody knows, compared against when the username
 * does not exist so that a missing account costs the same time as a wrong
 * password. Without this, response timing reveals which usernames are real.
 */
const DUMMY_HASH = "$2b$12$FfO2YXq.LXKpVClpQw8ucen3DzCbYXRKQoJmYIwBqyV0sW4bSyVC6"

const INVALID = "Invalid username or password."

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  return forwarded?.split(",")[0]?.trim() || "unknown"
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    username?: unknown
    password?: unknown
  } | null

  const username =
    typeof body?.username === "string" ? body.username.trim().toLowerCase() : ""
  const password = typeof body?.password === "string" ? body.password : ""

  if (!username || !password) {
    return NextResponse.json(
      { error: "Please enter both username and password." },
      { status: 400 }
    )
  }

  const throttleKey = `${clientIp(request)}:${username}`
  const wait = retryAfter(throttleKey)
  if (wait > 0) {
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${Math.ceil(wait / 60)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(wait) } }
    )
  }

  const user = await prisma.user.findUnique({
    where: { username },
    include: { loginRoute: { select: { id: true } } },
  })

  // Always run a comparison so the timing does not distinguish the two cases.
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)

  if (!user || !passwordOk) {
    recordFailure(throttleKey)
    return NextResponse.json({ error: INVALID }, { status: 401 })
  }

  if (!user.isActive) {
    recordFailure(throttleKey)
    return NextResponse.json(
      { error: "This account has been disabled. Contact your administrator." },
      { status: 403 }
    )
  }

  // Route logins are for the mobile app only.
  if (user.loginRoute) {
    return NextResponse.json(
      { error: "Route logins work in the mobile app only." },
      { status: 403 }
    )
  }

  clearFailures(throttleKey)

  const role = user.role as Role
  const response = NextResponse.json({
    user: { username: user.username, name: user.name, role },
    redirectTo: homeFor(role),
  })

  await startSession(response, { id: user.id, role }, {
    userAgent: request.headers.get("user-agent"),
    ip: clientIp(request),
  })

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  return response
}
