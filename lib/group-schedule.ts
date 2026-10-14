import "server-only"

import type { Prisma } from "@/lib/generated/prisma"

/**
 * The monthly auction rounds a new group runs on.
 *
 * A chit is a fixed number of months, one auction each, and the register is
 * built from those rows: with no schedule a group never appears in Auctions and
 * has no round to seat an auction hall against.
 */

/** The hour branches open the hall, as a wall-clock "HH:mm". */
const AUCTION_TIME = "10:00"

/** "21/03/2026" -> Date, or null when it is not a dd/MM/yyyy date. */
function parseDisplayDate(value: string): Date | null {
  const [d, m, y] = value.split("/").map(Number)
  if (!d || !m || !y) return null

  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Whole months from `start` to `end`, counting the month `start` falls in. */
function monthsBetween(start: Date, end: Date): number {
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  return months + 1
}

/**
 * Creates one scheduled round a month, on the group's start day, from its start
 * date onwards. A chit cannot run longer than it has seats — every member takes
 * the pot once — so the run is capped at `totalTickets` rounds.
 *
 * Returns how many rounds were created.
 */
export async function createSchedule(
  tx: Prisma.TransactionClient,
  groupId: number,
  group: { startDate: string; endDate: string; totalTickets: number }
): Promise<number> {
  const start = parseDisplayDate(group.startDate)
  const end = parseDisplayDate(group.endDate)
  if (!start || !end || end <= start) return 0

  const rounds = Math.min(monthsBetween(start, end), group.totalTickets)
  if (rounds < 1) return 0

  await tx.auction.createMany({
    data: Array.from({ length: rounds }, (_, index) => ({
      groupId,
      installmentNo: index + 1,
      // Built off the start day rather than by adding 30 days, so every round
      // lands on the same date of the month the chit started on.
      auctionDate: new Date(start.getFullYear(), start.getMonth() + index, start.getDate()),
      auctionTime: AUCTION_TIME,
    })),
  })

  return rounds
}
