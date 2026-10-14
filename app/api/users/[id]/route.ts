import { NextResponse } from "next/server"
import { Prisma } from "@/lib/generated/prisma"

import { prisma } from "@/lib/prisma"
import { authorizeApi, revokeAllSessions } from "@/lib/auth-server"
import { hashPassword } from "@/lib/password"
import { canManageUser } from "@/lib/rbac"
import type { Role } from "@/lib/roles"
import { parseUserUpdate } from "@/lib/user-schema"

type Context = { params: Promise<{ id: string }> }

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

const PUBLIC_FIELDS = {
  id: true,
  username: true,
  email: true,
  name: true,
  role: true,
  branches: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect

const forbidden = (message: string, field = "role") =>
  NextResponse.json({ errors: { [field]: message } }, { status: 403 })

/**
 * Refuses a change that would remove the last way into the system. Returns a
 * message when the change is unsafe, else null.
 */
async function wouldOrphanSystem(
  target: { id: number; role: Role; isActive: boolean },
  next: { role: Role; isActive: boolean } | null
): Promise<string | null> {
  const wasUsableSuperAdmin = target.role === "SUPER_ADMIN" && target.isActive
  if (!wasUsableSuperAdmin) return null

  const stillUsable = next !== null && next.role === "SUPER_ADMIN" && next.isActive
  if (stillUsable) return null

  const others = await prisma.user.count({
    where: { role: "SUPER_ADMIN", isActive: true, id: { not: target.id } },
  })

  return others > 0
    ? null
    : "This is the last active Super Admin — promote another account first."
}

export async function PATCH(request: Request, { params }: Context) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const id = Number((await params).id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ errors: { id: "Invalid user id" } }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) {
    return NextResponse.json({ errors: { id: "User not found" } }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const parsed = parseUserUpdate(body)
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 })
  }

  // Checked against both the current row and the requested one, so a Chit Admin
  // can neither edit an account outside their scope nor push one out of it.
  const currentDenial = canManageUser(auth.user, {
    id: target.id,
    role: target.role as Role,
    branches: target.branches,
  })
  if (currentDenial) return forbidden(currentDenial)

  const nextDenial = canManageUser(auth.user, {
    id: target.id,
    role: parsed.data.role,
    branches: parsed.data.branches,
  })
  if (nextDenial) return forbidden(nextDenial)

  const orphan = await wouldOrphanSystem(
    { id: target.id, role: target.role as Role, isActive: target.isActive },
    { role: parsed.data.role, isActive: parsed.data.isActive }
  )
  if (orphan) return forbidden(orphan)

  const data: Prisma.UserUpdateInput = {
    email: parsed.data.email,
    name: parsed.data.name,
    role: parsed.data.role,
    branches: parsed.data.branches,
    isActive: parsed.data.isActive,
  }

  if (parsed.data.password) {
    data.passwordHash = await hashPassword(parsed.data.password)
  }

  try {
    const user = await prisma.user.update({ where: { id }, data, select: PUBLIC_FIELDS })

    // Any of these invalidate what an existing session was granted, so the
    // target is signed out everywhere and must authenticate again.
    const privilegesChanged =
      parsed.data.role !== target.role ||
      parsed.data.isActive !== target.isActive ||
      Boolean(parsed.data.password) ||
      parsed.data.branches.join("|") !== target.branches.join("|")

    if (privilegesChanged) await revokeAllSessions(id)

    return NextResponse.json(user)
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { errors: { email: "That email is already taken" } },
        { status: 409 }
      )
    }
    throw error
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const id = Number((await params).id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ errors: { id: "Invalid user id" } }, { status: 400 })
  }

  if (id === auth.user.id) {
    return forbidden("You cannot delete your own account.", "id")
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) {
    return NextResponse.json({ errors: { id: "User not found" } }, { status: 404 })
  }

  const denial = canManageUser(auth.user, {
    id: target.id,
    role: target.role as Role,
    branches: target.branches,
  })
  if (denial) return forbidden(denial)

  const orphan = await wouldOrphanSystem(
    { id: target.id, role: target.role as Role, isActive: target.isActive },
    null
  )
  if (orphan) return forbidden(orphan, "id")

  // Sessions cascade on delete, so the account loses access immediately.
  await prisma.user.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
