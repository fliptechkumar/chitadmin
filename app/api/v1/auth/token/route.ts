import { prisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/password"
import type { Role } from "@/lib/roles"
import { clearFailures, recordFailure, retryAfter } from "@/lib/login-throttle"
import { createMobileSession } from "@/lib/api/tokens"
import { apiError, apiOk, withApiErrors } from "@/lib/api/response"

/** See app/api/auth/login/route.ts — same reasoning, constant-work compare. */
const DUMMY_HASH = "$2b$12$FfO2YXq.LXKpVClpQw8ucen3DzCbYXRKQoJmYIwBqyV0sW4bSyVC6"

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  return forwarded?.split(",")[0]?.trim() || "unknown"
}

/**
 * POST /api/v1/auth/token
 *
 * Exchanges credentials for an access/refresh pair. The mobile equivalent of
 * the browser's cookie login; both create a Session row, so an admin revoking
 * a user's access cuts off phone and browser alike.
 */
export async function POST(request: Request) {
  return withApiErrors(async () => {
    const body = (await request.json().catch(() => null)) as {
      username?: unknown
      password?: unknown
    } | null

    const username =
      typeof body?.username === "string" ? body.username.trim().toLowerCase() : ""
    const password = typeof body?.password === "string" ? body.password : ""

    if (!username || !password) {
      return apiError("VALIDATION_FAILED", "Username and password are required.", {
        fields: {
          ...(username ? {} : { username: "Username is required" }),
          ...(password ? {} : { password: "Password is required" }),
        },
      })
    }

    const throttleKey = `${clientIp(request)}:${username}`
    const wait = retryAfter(throttleKey)
    if (wait > 0) {
      return apiError(
        "RATE_LIMITED",
        `Too many failed attempts. Try again in ${Math.ceil(wait / 60)} minute(s).`,
        { headers: { "Retry-After": String(wait) } }
      )
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { loginRoute: { select: { id: true, code: true, name: true, branch: true, isActive: true } } },
    })
    const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)

    if (!user || !passwordOk) {
      recordFailure(throttleKey)
      return apiError("UNAUTHENTICATED", "Invalid username or password.")
    }

    if (!user.isActive || user.loginRoute?.isActive === false) {
      recordFailure(throttleKey)
      return apiError("FORBIDDEN", "This account has been disabled.")
    }

    clearFailures(throttleKey)

    const tokens = await createMobileSession(
      { id: user.id, role: user.role as Role },
      { userAgent: request.headers.get("user-agent"), ip: clientIp(request) }
    )

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    return apiOk({
      ...tokens,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        branches: user.branches,
        route: user.loginRoute
          ? { id: user.loginRoute.id, code: user.loginRoute.code, name: user.loginRoute.name, branch: user.loginRoute.branch }
          : null,
      },
    })
  })
}
