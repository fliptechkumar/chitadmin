import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { authorizeApi, denyOutsideBranch } from "@/lib/auth-server"
import {
  serializeTicket,
  syncGroupCounts,
  TICKET_SELECT,
} from "@/lib/ticket-select"

type Context = { params: Promise<{ id: string; ticketNo: string }> }

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

const STATUSES = ["active", "suspended", "closed"] as const
const COLLECTION_TYPES = ["daily", "weekly", "monthly"] as const

type Status = (typeof STATUSES)[number]
type CollectionType = (typeof COLLECTION_TYPES)[number]

/**
 * PATCH /api/groups/{id}/tickets/{ticketNo}
 *
 * Seats an applicant, clears the seat (`applicantId: null`), or changes its
 * route, collection type or status. The roster exists up front, so a seat is
 * only ever updated — never created here.
 */
export async function PATCH(request: Request, { params }: Context) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const { id: rawId, ticketNo: rawNo } = await params
  const groupId = Number(rawId)
  const ticketNo = Number(rawNo)

  if (!Number.isInteger(groupId) || !Number.isInteger(ticketNo)) {
    return NextResponse.json({ errors: { id: "Invalid ticket" } }, { status: 400 })
  }

  const ticket = await prisma.chitTicket.findUnique({
    where: { groupId_ticketNo: { groupId, ticketNo } },
    include: { group: { select: { branchName: true } } },
  })
  if (!ticket) {
    return NextResponse.json({ errors: { id: "Ticket not found" } }, { status: 404 })
  }

  const denied = denyOutsideBranch(auth.user, ticket.group.branchName)
  if (denied) return denied

  if (ticket.isCompany) {
    return NextResponse.json(
      { errors: { applicantId: "The company seat cannot be reassigned" } },
      { status: 403 }
    )
  }

  const body = (await request.json().catch(() => null)) as {
    applicantId?: unknown
    routeId?: unknown
    collectionType?: unknown
    status?: unknown
  } | null

  const data: {
    applicantId?: number | null
    routeId?: number | null
    collectionType?: CollectionType
    status?: Status
    assignedAt?: Date | null
  } = {}

  if (body?.applicantId !== undefined) {
    if (body.applicantId === null) {
      data.applicantId = null
      data.assignedAt = null
    } else {
      const applicantId = Number(body.applicantId)
      if (!Number.isInteger(applicantId)) {
        return NextResponse.json(
          { errors: { applicantId: "Select an applicant" } },
          { status: 400 }
        )
      }

      const applicant = await prisma.applicant.findUnique({
        where: { id: applicantId },
        select: { id: true, branch: true },
      })
      if (!applicant) {
        return NextResponse.json(
          { errors: { applicantId: "Applicant not found" } },
          { status: 404 }
        )
      }

      // A seat belongs to its group's branch, so the person taking it must too.
      if (applicant.branch !== ticket.group.branchName) {
        return NextResponse.json(
          {
            errors: {
              applicantId: `That applicant belongs to the ${applicant.branch} branch`,
            },
          },
          { status: 400 }
        )
      }

      // One seat per person per group: holding two tickets in the same chit
      // would double their obligation without anyone noticing.
      const alreadyHeld = await prisma.chitTicket.findFirst({
        where: { groupId, applicantId, ticketNo: { not: ticketNo } },
        select: { ticketNo: true },
      })
      if (alreadyHeld) {
        return NextResponse.json(
          {
            errors: {
              applicantId: `Already holds ticket ${alreadyHeld.ticketNo} in this group`,
            },
          },
          { status: 409 }
        )
      }

      data.applicantId = applicantId
      data.assignedAt = new Date()
    }
  }

  if (body?.routeId !== undefined) {
    if (body.routeId === null) {
      data.routeId = null
    } else {
      const routeId = Number(body.routeId)
      const route = await prisma.route.findUnique({
        where: { id: routeId },
        select: { branch: true },
      })
      if (!route) {
        return NextResponse.json(
          { errors: { routeId: "Route not found" } },
          { status: 404 }
        )
      }

      const deniedRoute = denyOutsideBranch(auth.user, route.branch)
      if (deniedRoute) return deniedRoute

      data.routeId = routeId
    }
  }

  if (body?.collectionType !== undefined) {
    if (!COLLECTION_TYPES.includes(body.collectionType as CollectionType)) {
      return NextResponse.json(
        { errors: { collectionType: "Unknown collection type" } },
        { status: 400 }
      )
    }
    data.collectionType = body.collectionType as CollectionType
  }

  if (body?.status !== undefined) {
    if (!STATUSES.includes(body.status as Status)) {
      return NextResponse.json({ errors: { status: "Unknown status" } }, { status: 400 })
    }
    data.status = body.status as Status
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ errors: { id: "Nothing to update" } }, { status: 400 })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.chitTicket.update({
      where: { groupId_ticketNo: { groupId, ticketNo } },
      data,
      select: TICKET_SELECT,
    })

    // Seating an applicant moves them on in the enrolment workflow.
    if (data.applicantId) {
      await tx.applicant.update({
        where: { id: data.applicantId },
        data: { status: "allocated" },
      })
    }

    if (data.applicantId !== undefined) await syncGroupCounts(tx, groupId)

    return row
  })

  return NextResponse.json(serializeTicket(updated))
}
