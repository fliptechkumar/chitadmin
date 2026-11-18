import "server-only"

import { prisma } from "./prisma"
import type { Participant } from "./auction-types"

export type { Participant }

/** The calendar day an instant falls on for the branches, yyyy-mm-dd. */
export const istDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })

/**
 * Who may bid in a group's auctions, and who no longer can.
 *
 * A seat takes the pot once: after that the member keeps paying but drops out
 * of the bidding, so every later round is contested by a smaller field. The
 * same rule is enforced by a unique index on (groupId, winnerTicketId), so
 * this is the readable view of a constraint the database also holds.
 *
 * A seat counts as prized when an auction names it the winner or when the
 * seat itself is flagged, as members carried over from the old register are.
 *
 * The company seat never bids, and vacant seats have nobody to bid for them.
 */
export async function participantsFor(groupId: number): Promise<{
  eligible: Participant[]
  won: Participant[]
}> {
  const [tickets, wins] = await Promise.all([
    prisma.chitTicket.findMany({
      where: { groupId, isCompany: false, applicantId: { not: null } },
      select: {
        id: true,
        ticketNo: true,
        isPrized: true,
        prizedOn: true,
        prizedDue: true,
        applicant: {
          select: { applicantCode: true, firstName: true, lastName: true, mobile: true },
        },
      },
      orderBy: { ticketNo: "asc" },
    }),
    prisma.auction.findMany({
      where: { groupId, winnerTicketId: { not: null } },
      select: { winnerTicketId: true, installmentNo: true },
    }),
  ])

  const wonRoundByTicket = new Map(
    wins.map((w) => [w.winnerTicketId as number, w.installmentNo])
  )

  const rows: Participant[] = tickets.map((t) => ({
    ticketId: t.id,
    ticketNo: t.ticketNo,
    code: t.applicant?.applicantCode ?? "",
    name: `${t.applicant?.firstName ?? ""} ${t.applicant?.lastName ?? ""}`.trim(),
    mobile: t.applicant?.mobile ?? "",
    wonRound: wonRoundByTicket.get(t.id) ?? t.prizedDue ?? null,
    // Seats imported as prized have no winning auction row, so the flag on the
    // seat counts too; otherwise they would be offered the pot a second time.
    prized: t.isPrized || wonRoundByTicket.has(t.id),
    prizedOn: t.prizedOn ? istDay(t.prizedOn) : null,
  }))

  return {
    eligible: rows.filter((r) => !r.prized),
    // Rounds won here first, in order; carried-over prized seats after, by seat.
    won: rows
      .filter((r) => r.prized)
      .sort((a, b) => (a.wonRound ?? Infinity) - (b.wonRound ?? Infinity) || a.ticketNo - b.ticketNo),
  }
}
