import { NextResponse } from "next/server"
import { Prisma } from "@/lib/generated/prisma"

import { prisma } from "@/lib/prisma"
import { authorizeApi, denyOutsideBranch } from "@/lib/auth-server"
import { parseGroupInput } from "@/lib/group-schema"
import {
  resizeRoster,
  serializeTicket,
  syncGroupCounts,
  TICKET_SELECT,
} from "@/lib/ticket-select"

type Context = { params: Promise<{ id: string }> }

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

/** Thrown to roll a group edit back when its seat change cannot be applied. */
class RosterRefused extends Error {}

// Prisma throws P2025 when an update/delete targets a row that no longer exists.
function isMissingRow(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"
  )
}

const notFound = () =>
  NextResponse.json({ errors: { id: "Group not found" } }, { status: 404 })

/** GET — the group plus its full ticket roster, for the detail screen. */
export async function GET(_request: Request, { params }: Context) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const id = Number((await params).id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ errors: { id: "Invalid group id" } }, { status: 400 })
  }

  const group = await prisma.chitGroup.findUnique({
    where: { id },
    include: { tickets: { select: TICKET_SELECT, orderBy: { ticketNo: "asc" } } },
  })
  if (!group) return notFound()

  const denied = denyOutsideBranch(auth.user, group.branchName)
  if (denied) return denied

  return NextResponse.json({
    ...group,
    tickets: group.tickets.map(serializeTicket),
  })
}

export async function PUT(request: Request, { params }: Context) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const id = Number((await params).id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ errors: { id: "Invalid group id" } }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const parsed = parseGroupInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 })
  }

  const existing = await prisma.chitGroup.findUnique({
    where: { id },
    select: { branchName: true },
  })
  if (!existing) return notFound()

  // Both ends are checked: a Chit Admin may not edit a group outside their
  // branches, nor move one of their groups into a branch they do not hold.
  const deniedSource = denyOutsideBranch(auth.user, existing.branchName)
  if (deniedSource) return deniedSource

  const deniedTarget = denyOutsideBranch(auth.user, parsed.data.branchName)
  if (deniedTarget) return deniedTarget

  try {
    // Seats are part of the group, so changing the count moves the roster with
    // it. A refusal is thrown rather than returned, so the group edit rolls
    // back with the resize instead of half-applying.
    const group = await prisma.$transaction(async (tx) => {
      await tx.chitGroup.update({ where: { id }, data: parsed.data })

      const refused = await resizeRoster(tx, id, parsed.data.totalTickets)
      if (refused) throw new RosterRefused(refused)

      await syncGroupCounts(tx, id)
      return tx.chitGroup.findUniqueOrThrow({ where: { id } })
    })

    return NextResponse.json(group)
  } catch (error) {
    if (error instanceof RosterRefused) {
      return NextResponse.json({ errors: { totalTickets: error.message } }, { status: 409 })
    }
    if (isMissingRow(error)) return notFound()
    throw error
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const id = Number((await params).id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ errors: { id: "Invalid group id" } }, { status: 400 })
  }

  const existing = await prisma.chitGroup.findUnique({
    where: { id },
    select: { branchName: true },
  })
  if (!existing) return notFound()

  const denied = denyOutsideBranch(auth.user, existing.branchName)
  if (denied) return denied

  try {
    await prisma.chitGroup.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    if (isMissingRow(error)) return notFound()
    throw error
  }
}
