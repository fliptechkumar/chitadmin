/**
 * The shapes the auction desk sends over the wire.
 *
 * Kept apart from the query modules because those are server-only: the client
 * needs the types without pulling a Prisma import into the bundle.
 */

/** A seat in a group, as the bidding field lists it. */
export type Participant = {
  ticketId: number
  ticketNo: number
  code: string
  name: string
  mobile: string
  /** The round they took the pot in, when they are no longer eligible. */
  wonRound: number | null
}

/** A member assigned to one round's auction hall. */
export type HallSeat = {
  entryId: number
  ticketId: number
  ticketNo: number
  code: string
  name: string
  mobile: string
  addedAt: string
  isWinner: boolean
}

export type AuctionStatus = "scheduled" | "completed" | "cancelled"

/** One round, read end to end — what the detail page renders from. */
export type AuctionDetail = {
  id: number
  branch: string
  groupId: number
  group: string
  groupValue: number
  totalTickets: number
  /** What a seat pays in a month with no dividend against it. */
  subscription: number
  installmentNo: number
  auctionDay: string
  auctionTime: string
  status: AuctionStatus
  prizeAmount: number
  discount: number
  dividend: number
  winner: HallSeat | null
  hall: HallSeat[]
  /** Seats that may still bid, and those that have taken the pot. */
  eligible: Participant[]
  won: Participant[]
}
