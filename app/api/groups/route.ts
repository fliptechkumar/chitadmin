import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { authorizeApi, denyOutsideBranch } from "@/lib/auth-server"
import { branchScope } from "@/lib/rbac"
import { parseGroupInput } from "@/lib/group-schema"
import { createRoster, syncGroupCounts } from "@/lib/ticket-select"
import { createSchedule } from "@/lib/group-schedule"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

export async function GET() {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  // Super Admins get an empty filter (everything); Chit Admins only their branches.
  const groups = await prisma.chitGroup.findMany({
    where: branchScope(auth.user, "branchName"),
    orderBy: { id: "asc" },
  })

  return NextResponse.json(groups)
}

export async function POST(request: Request) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const parsed = parseGroupInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 })
  }

  // A Chit Admin must not create groups in a branch they are not assigned to.
  const denied = denyOutsideBranch(auth.user, parsed.data.branchName)
  if (denied) return denied

  // A group is created with the two things it cannot work without: the seats
  // members are assigned to, and the monthly rounds those seats bid in. Without
  // them the group never reaches the dues or auction registers at all.
  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.chitGroup.create({
      data: { ...parsed.data, members: 0, vacants: parsed.data.totalTickets },
    })

    await createRoster(tx, created.id, parsed.data.totalTickets)
    await createSchedule(tx, created.id, parsed.data)
    await syncGroupCounts(tx, created.id)

    return tx.chitGroup.findUniqueOrThrow({ where: { id: created.id } })
  })

  return NextResponse.json(group, { status: 201 })
}
