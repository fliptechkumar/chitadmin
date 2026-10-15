import { NextResponse } from "next/server"
import { Prisma } from "@/lib/generated/prisma"

import { prisma } from "@/lib/prisma"
import { authorizeApi } from "@/lib/auth-server"
import { parseRouteInput } from "@/lib/route-schema"
import { ROUTE_SELECT, serializeRoute } from "@/lib/route-select"
import { prepareLogin, syncRouteLogin, usernameTaken } from "@/lib/route-login"

type Context = { params: Promise<{ id: string }> }

const SUPER_ONLY = ["SUPER_ADMIN"] as const

const notFound = () =>
  NextResponse.json({ errors: { id: "Route not found" } }, { status: 404 })

/** GET — the full record behind "View route". */
export async function GET(_request: Request, { params }: Context) {
  const auth = await authorizeApi(SUPER_ONLY)
  if (!auth.ok) return auth.response

  const id = Number((await params).id)
  if (!Number.isInteger(id)) {
    return NextResponse.json(
      { errors: { id: "Invalid route id" } },
      { status: 400 }
    )
  }

  const route = await prisma.route.findUnique({
    where: { id },
    select: ROUTE_SELECT,
  })
  if (!route) return notFound()

  return NextResponse.json(serializeRoute(route))
}

export async function PUT(request: Request, { params }: Context) {
  const auth = await authorizeApi(SUPER_ONLY)
  if (!auth.ok) return auth.response

  const id = Number((await params).id)
  if (!Number.isInteger(id)) {
    return NextResponse.json(
      { errors: { id: "Invalid route id" } },
      { status: 400 }
    )
  }

  const existing = await prisma.route.findUnique({
    where: { id },
    select: { id: true, loginUserId: true },
  })
  if (!existing) return notFound()

  const parsed = parseRouteInput(
    await request.json().catch(() => null),
    existing.loginUserId !== null
  )
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 })
  }

  const input = parsed.data

  // Deduplicated: the incharge may also be listed as an executive, and the
  // count below compares against the number of distinct rows.
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

  const taken = await usernameTaken(input.username, existing.loginUserId)
  if (taken)
    return NextResponse.json({ errors: { username: taken } }, { status: 409 })
  const prepared = await prepareLogin(input)

  try {
    const route = await prisma.$transaction(async (tx) => {
      const updated = await tx.route.update({
        where: { id },
        data: {
          code: input.code,
          name: input.name,
          branch: input.branch,
          areas: input.areas,
          notes: input.notes || null,
          isActive: input.isActive,
          inchargeId: input.inchargeId,
          // Replaced wholesale: simpler than diffing, and the join rows carry no
          // state of their own beyond display order.
          executives: {
            deleteMany: {},
            create: input.executiveIds.map((employeeId, position) => ({
              employeeId,
              position,
            })),
          },
        },
        select: { id: true, code: true, name: true, loginUserId: true },
      })
      await syncRouteLogin(tx, updated, input, prepared)
      return tx.route.findUniqueOrThrow({ where: { id }, select: ROUTE_SELECT })
    })

    return NextResponse.json(serializeRoute(route))
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

export async function DELETE(_request: Request, { params }: Context) {
  const auth = await authorizeApi(SUPER_ONLY)
  if (!auth.ok) return auth.response

  const id = Number((await params).id)
  if (!Number.isInteger(id)) {
    return NextResponse.json(
      { errors: { id: "Invalid route id" } },
      { status: 400 }
    )
  }

  const existing = await prisma.route.findUnique({
    where: { id },
    select: { id: true, loginUserId: true },
  })
  if (!existing) return notFound()

  // Executive rows cascade with the route; its login goes with it, which
  // also ends any mobile sessions it holds.
  await prisma.$transaction([
    prisma.route.delete({ where: { id } }),
    ...(existing.loginUserId
      ? [prisma.user.delete({ where: { id: existing.loginUserId } })]
      : []),
  ])
  return new NextResponse(null, { status: 204 })
}
