import "server-only"

import type { Prisma } from "@/lib/generated/prisma"

import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/password"
import type { RouteInput } from "@/lib/route-schema"

/**
 * A route signs in to the mobile app through an ordinary USER account linked
 * by Route.loginUserId. That keeps one credential table, so login throttling,
 * token refresh and session revocation work for routes unchanged.
 */

type Tx = Prisma.TransactionClient

/** Null when the username is free, or an error message for the form. */
export async function usernameTaken(
  username: string,
  ownLoginId: number | null
) {
  if (!username) return null
  const other = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  })
  return other && other.id !== ownLoginId
    ? "That username is already used"
    : null
}

/** Done before the transaction: bcrypt is slow and should not hold row locks. */
export async function prepareLogin(input: RouteInput) {
  return {
    passwordHash: input.password ? await hashPassword(input.password) : null,
  }
}

/**
 * Brings the route's login in line with the saved form: creates it, updates
 * it, or removes it when the username was cleared. A changed username,
 * password or a deactivated route signs out every device already logged in.
 */
export async function syncRouteLogin(
  tx: Tx,
  route: { id: number; code: string; name: string; loginUserId: number | null },
  input: RouteInput,
  prepared: { passwordHash: string | null }
) {
  const profile = {
    username: input.username,
    name: `Route ${route.code} · ${route.name}`,
    branches: [input.branch],
    isActive: input.isActive,
  }

  if (!input.username) {
    if (route.loginUserId)
      await tx.user.delete({ where: { id: route.loginUserId } })
    return
  }

  if (!route.loginUserId) {
    const user = await tx.user.create({
      data: {
        ...profile,
        // Email is required and unique on User; routes have none of their own.
        email: `${input.username}@route.local`,
        passwordHash: prepared.passwordHash!,
        role: "USER",
      },
      select: { id: true },
    })
    await tx.route.update({
      where: { id: route.id },
      data: { loginUserId: user.id },
    })
    return
  }

  const before = await tx.user.findUnique({
    where: { id: route.loginUserId },
    select: { username: true },
  })
  await tx.user.update({
    where: { id: route.loginUserId },
    data: {
      ...profile,
      email: `${input.username}@route.local`,
      ...(prepared.passwordHash ? { passwordHash: prepared.passwordHash } : {}),
    },
  })
  if (
    prepared.passwordHash ||
    !input.isActive ||
    before?.username !== input.username
  ) {
    await tx.session.deleteMany({ where: { userId: route.loginUserId } })
  }
}
