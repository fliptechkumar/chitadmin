import "server-only"

import type { Prisma } from "@/lib/generated/prisma"

/**
 * A seat, with everything the roster and the assign dialog display. The route
 * carries its executives and incharge so the dialog can show who will collect
 * without a second request — those are read from the route, never copied onto
 * the ticket, so re-staffing a route updates every seat on it at once.
 */
export const TICKET_SELECT = {
  id: true,
  ticketNo: true,
  isCompany: true,
  status: true,
  collectionType: true,
  assignedAt: true,
  applicant: {
    select: {
      id: true,
      applicantCode: true,
      firstName: true,
      lastName: true,
      mobile: true,
      area: true,
    },
  },
  route: {
    select: {
      id: true,
      code: true,
      name: true,
      incharge: { select: { id: true, name: true } },
      executives: {
        select: { employee: { select: { id: true, name: true } } },
        orderBy: { position: "asc" },
      },
    },
  },
} satisfies Prisma.ChitTicketSelect

type TicketRow = Prisma.ChitTicketGetPayload<{ select: typeof TICKET_SELECT }>

export function serializeTicket(row: TicketRow) {
  return {
    id: row.id,
    ticketNo: row.ticketNo,
    isCompany: row.isCompany,
    status: row.status,
    collectionType: row.collectionType,
    assignedAt: row.assignedAt?.toISOString() ?? null,
    applicant: row.applicant
      ? {
          id: row.applicant.id,
          code: row.applicant.applicantCode,
          name: `${row.applicant.firstName} ${row.applicant.lastName}`.trim(),
          mobile: row.applicant.mobile,
          area: row.applicant.area,
        }
      : null,
    route: row.route
      ? {
          id: row.route.id,
          code: row.route.code,
          name: row.route.name,
          manager: row.route.incharge?.name ?? null,
          executives: row.route.executives.map((e) => e.employee.name),
        }
      : null,
  }
}

export type SerializedTicket = ReturnType<typeof serializeTicket>

/**
 * Creates the seats a group runs on. Seat 1 is the foreman's own and the rest
 * start vacant, so a new group opens with a full board to assign members onto.
 *
 * Called when a group is created — a group without a roster has nowhere to put
 * members, which leaves it invisible to the dues and auction registers.
 */
export async function createRoster(
  tx: Prisma.TransactionClient,
  groupId: number,
  totalTickets: number,
  /** First seat number to create, for growing a roster that already exists. */
  from = 1
) {
  if (totalTickets < from) return

  await tx.chitTicket.createMany({
    data: Array.from({ length: totalTickets - from + 1 }, (_, index) => ({
      groupId,
      ticketNo: from + index,
      isCompany: from + index === 1,
    })),
  })
}

/**
 * Grows or shrinks a roster to `totalTickets`. Seats are only ever dropped off
 * the end, and only while they are empty — a seat someone holds is a member's
 * place in the chit, not a number to be trimmed.
 *
 * Returns a reason when the change is refused, or null when it is applied.
 */
export async function resizeRoster(
  tx: Prisma.TransactionClient,
  groupId: number,
  totalTickets: number
): Promise<string | null> {
  const current = await tx.chitTicket.count({ where: { groupId } })
  if (current === totalTickets) return null

  if (totalTickets > current) {
    await createRoster(tx, groupId, totalTickets, current + 1)
    return null
  }

  const held = await tx.chitTicket.count({
    where: { groupId, ticketNo: { gt: totalTickets }, applicantId: { not: null } },
  })
  if (held > 0) {
    return `Seats above ${totalTickets} are held by ${held} member${
      held === 1 ? "" : "s"
    } — clear them first`
  }

  await tx.chitTicket.deleteMany({ where: { groupId, ticketNo: { gt: totalTickets } } })
  return null
}

/**
 * Keeps the counters on ChitGroup in step with its roster. They drive the
 * groups list, which would otherwise drift as seats are filled.
 */
export async function syncGroupCounts(
  tx: Prisma.TransactionClient,
  groupId: number
) {
  const [taken, total] = await Promise.all([
    tx.chitTicket.count({ where: { groupId, applicantId: { not: null } } }),
    tx.chitTicket.count({ where: { groupId } }),
  ])

  await tx.chitGroup.update({
    where: { id: groupId },
    data: { members: taken, vacants: total - taken },
  })
}
