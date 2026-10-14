import { NextResponse } from "next/server"
import { Prisma } from "@/lib/generated/prisma"

import { prisma } from "@/lib/prisma"
import { authorizeApi } from "@/lib/auth-server"
import { hashPassword } from "@/lib/password"
import { canManageUser, userListScope } from "@/lib/rbac"
import { parseUserCreate } from "@/lib/user-schema"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

/** Columns safe to return — never the password hash. */
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

export async function GET() {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const users = await prisma.user.findMany({
    where: userListScope(auth.user),
    select: PUBLIC_FIELDS,
    orderBy: [{ role: "asc" }, { username: "asc" }],
  })

  return NextResponse.json(users)
}

export async function POST(request: Request) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const parsed = parseUserCreate(body)
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 })
  }

  // A Chit Admin may only create Users, and only inside their own branches.
  const denial = canManageUser(auth.user, {
    role: parsed.data.role,
    branches: parsed.data.branches,
  })
  if (denial) {
    return NextResponse.json({ errors: { role: denial } }, { status: 403 })
  }

  try {
    const user = await prisma.user.create({
      data: {
        username: parsed.data.username,
        email: parsed.data.email,
        name: parsed.data.name,
        role: parsed.data.role,
        branches: parsed.data.branches,
        isActive: parsed.data.isActive,
        passwordHash: await hashPassword(parsed.data.password),
      },
      select: PUBLIC_FIELDS,
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    // P2002 = unique constraint; tell the caller which field collided.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = (error.meta?.target as string[] | undefined) ?? []
      const field = target.includes("email") ? "email" : "username"
      return NextResponse.json(
        { errors: { [field]: `That ${field} is already taken` } },
        { status: 409 }
      )
    }
    throw error
  }
}
