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
  /** The round they took the pot in: from the auction, or the old register. */
  wonRound: number | null
  /**
   * Already prized, whether by an auction above or as carried over from the
   * old register (where no auction row names the winner).
   */
  prized: boolean
  /** The day the seat was prized (yyyy-mm-dd, IST), if the register gave one. */
  prizedOn: string | null
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

/** A seat that has taken the pot, as the group-wise prized list shows it. */
export type PrizedRecord = {
  ticketId: number
  groupId: number
  group: string
  branch: string
  groupValue: number
  totalTickets: number
  ticketNo: number
  code: string
  name: string
  mobile: string
  /** The round (due no) the seat was prized in, when known. */
  wonRound: number | null
  /** True when an auction held in this system names the seat the winner. */
  viaAuction: boolean
  /** yyyy-mm-dd (IST) the seat was prized, when known. */
  prizedOn: string | null
  /**
   * What the winner took: the auction's own figure when one was held here,
   * otherwise the payout the group's chit interval schedules for that due.
   */
  prizeAmount: number | null
  /** Where prizeAmount came from, so the list can say when it is scheduled. */
  prizeSource: "auction" | "interval" | null
}
