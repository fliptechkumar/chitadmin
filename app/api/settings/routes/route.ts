import { NextResponse } from "next/server"
import { Prisma } from "@/lib/generated/prisma"

import { prisma } from "@/lib/prisma"
import { authorizeApi } from "@/lib/auth-server"
import { parseRouteInput } from "@/lib/route-schema"
import { ROUTE_SELECT, serializeRoute } from "@/lib/route-select"
import { prepareLogin, syncRouteLogin, usernameTaken } from "@/lib/route-login"

/** Routes live under Settings, which is Super-Admin-only (see lib/rbac.ts). */
const SUPER_ONLY = ["SUPER_ADMIN"] as const

export async function GET() {
  const auth = await authorizeApi(SUPER_ONLY)
  if (!auth.ok) return auth.response

  const routes = await prisma.route.findMany({
    select: ROUTE_SELECT,
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(routes.map(serializeRoute))
}

export async function POST(request: Request) {
  const auth = await authorizeApi(SUPER_ONLY)
  if (!auth.ok) return auth.response

  const parsed = parseRouteInput(await request.json().catch(() => null))
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 })
  }

  const input = parsed.data

  // Referenced staff must exist, otherwise the FK fails with an opaque error.
  // Deduplicated because the incharge may also be listed as an executive, and
  // the count below compares against the number of distinct rows.
  const staffIds = [
    ...new Set([
      ...input.executiveIds,
      ...(input.inchargeId ? [input.inchargeId] : []),
    ]),
  ]
  if (staffIds.length > 0) {
    const found = await prisma.employee.count({
      where: { id: { in: staffIds } },
    })
    if (found !== staffIds.length) {
      return NextResponse.json(
        {
          errors: {
            executiveIds: "One of the selected staff no longer exists",
          },
        },
        { status: 400 }
      )
    }
  }

  const taken = await usernameTaken(input.username, null)
  if (taken)
    return NextResponse.json({ errors: { username: taken } }, { status: 409 })
  const prepared = await prepareLogin(input)

  try {
    const route = await prisma.$transaction(async (tx) => {
      const created = await tx.route.create({
        data: {
          code: input.code,
          name: input.name,
          branch: input.branch,
          areas: input.areas,
          notes: input.notes || null,
          isActive: input.isActive,
          inchargeId: input.inchargeId,
          createdById: auth.user.id,
          executives: {
            create: input.executiveIds.map((employeeId, position) => ({
              employeeId,
              position,
            })),
          },
        },
        select: { id: true, code: true, name: true, loginUserId: true },
      })
      await syncRouteLogin(tx, created, input, prepared)
      return tx.route.findUniqueOrThrow({
        where: { id: created.id },
        select: ROUTE_SELECT,
      })
    })

    return NextResponse.json(serializeRoute(route), { status: 201 })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { errors: { code: "That route code is already used" } },
        { status: 409 }
      )
    }
    throw error
  }
}
