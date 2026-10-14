import "server-only"

import { prisma } from "./prisma"
import { participantsFor } from "./auction-participants"
import type { AuctionDetail, HallSeat } from "./auction-types"

export type { AuctionDetail, HallSeat }

/**
 * One round, read end to end: its figures, the members of the group put down
 * for that month's auction, and the field they were drawn from.
 *
 * The hall is attendance and nothing else. What the round settled at — the pot,
 * the discount, the dividend — is held on the Auction row, so assigning a
 * member to a month never moves money.
 */

/** The undiscounted monthly subscription: the chit value split over its seats. */
export function subscriptionFor(groupValue: number, totalTickets: number): number {
  if (totalTickets <= 0) return 0
  return Math.round(groupValue / totalTickets)
}

/** yyyy-mm-dd in server-local time, matching how ?date= is interpreted. */
export function localDay(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate()
  ).padStart(2, "0")}`
}

const SEAT_SELECT = {
  id: true,
  ticketNo: true,
  applicant: {
    select: { applicantCode: true, firstName: true, lastName: true, mobile: true },
  },
} as const

type SeatRow = {
  id: number
  ticketNo: number
  applicant: {
    applicantCode: string
    firstName: string
    lastName: string
    mobile: string
  } | null
}

function seatFields(ticket: SeatRow) {
  return {
    ticketId: ticket.id,
    ticketNo: ticket.ticketNo,
    code: ticket.applicant?.applicantCode ?? "",
    name: `${ticket.applicant?.firstName ?? ""} ${ticket.applicant?.lastName ?? ""}`.trim(),
    mobile: ticket.applicant?.mobile ?? "",
  }
}

/**
 * The whole round for the detail page. Returns null when there is no such
 * auction; the caller checks the branch against `branch` before showing it.
 */
export async function auctionDetailFor(id: number): Promise<AuctionDetail | null> {
  const auction = await prisma.auction.findUnique({
    where: { id },
    select: {
      id: true,
      installmentNo: true,
      auctionDate: true,
      auctionTime: true,
      prizeAmount: true,
      discount: true,
      dividend: true,
      status: true,
      winnerTicketId: true,
      group: {
        select: {
          id: true,
          group: true,
          branchName: true,
          amount: true,
          totalTickets: true,
        },
      },
      winnerTicket: { select: SEAT_SELECT },
      hall: {
        select: { id: true, addedAt: true, ticket: { select: SEAT_SELECT } },
        orderBy: { addedAt: "asc" },
      },
    },
  })
  if (!auction) return null

  const { eligible, won } = await participantsFor(auction.group.id)

  return {
    id: auction.id,
    branch: auction.group.branchName,
    groupId: auction.group.id,
    group: auction.group.group,
    groupValue: auction.group.amount,
    totalTickets: auction.group.totalTickets,
    subscription: subscriptionFor(auction.group.amount, auction.group.totalTickets),
    installmentNo: auction.installmentNo,
    auctionDay: localDay(auction.auctionDate),
    auctionTime: auction.auctionTime,
    status: auction.status,
    prizeAmount: auction.prizeAmount,
    discount: auction.discount,
    dividend: auction.dividend,
    winner: auction.winnerTicket
      ? {
          entryId: 0,
          ...seatFields(auction.winnerTicket),
          addedAt: auction.auctionDate.toISOString(),
          isWinner: true,
        }
      : null,
    hall: auction.hall.map((entry) => ({
      entryId: entry.id,
      ...seatFields(entry.ticket),
      addedAt: entry.addedAt.toISOString(),
      isWinner: entry.ticket.id === auction.winnerTicketId,
    })),
    eligible,
    won,
  }
}

export type AuctionProblem = { message: string; status: number }

/** A round's hall is only worked on while the round is still to be held. */
function guardOpen(status: string): AuctionProblem | null {
  if (status === "completed") {
    return { message: "This round has been held — its hall is now a record.", status: 409 }
  }
  if (status === "cancelled") {
    return { message: "This round was cancelled.", status: 409 }
  }
  return null
}

/** Puts a member of the group down for this month's auction. */
export async function seatInHall(
  auctionId: number,
  ticketId: number
): Promise<AuctionProblem | null> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: { id: true, groupId: true, status: true },
  })
  if (!auction) return { message: "Auction not found", status: 404 }

  const open = guardOpen(auction.status)
  if (open) return open

  const ticket = await prisma.chitTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, groupId: true, isCompany: true, applicantId: true, isPrized: true },
  })

  // Eligibility is the same rule the bidding field is drawn by: a seated,
  // non-company member of this group who has not already taken the pot.
  if (!ticket || ticket.groupId !== auction.groupId) {
    return { message: "That seat is not in this group.", status: 400 }
  }
  if (ticket.isCompany || ticket.applicantId === null) {
    return { message: "That seat has no member to assign.", status: 400 }
  }
  if (ticket.isPrized) {
    return { message: "That member has already taken the pot.", status: 409 }
  }

  const existing = await prisma.auctionHallEntry.findUnique({
    where: { auctionId_ticketId: { auctionId, ticketId } },
    select: { id: true },
  })
  if (existing) return { message: "That member is already in the hall.", status: 409 }

  await prisma.auctionHallEntry.create({ data: { auctionId, ticketId } })
  return null
}

/** Takes a member back off this month's auction. */
export async function leaveHall(
  auctionId: number,
  entryId: number
): Promise<AuctionProblem | null> {
  const entry = await prisma.auctionHallEntry.findUnique({
    where: { id: entryId },
    select: { auctionId: true, auction: { select: { status: true } } },
  })
  if (!entry || entry.auctionId !== auctionId) {
    return { message: "That member is not in this hall.", status: 404 }
  }

  const open = guardOpen(entry.auction.status)
  if (open) return open

  await prisma.auctionHallEntry.delete({ where: { id: entryId } })
  return null
}
