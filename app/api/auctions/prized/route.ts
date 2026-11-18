import { NextResponse } from "next/server"
import type { Prisma } from "@/lib/generated/prisma"

import { istDay } from "@/lib/auction-participants"
import type { PrizedRecord } from "@/lib/auction-types"
import { authorizeApi } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { branchScope } from "@/lib/rbac"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

/**
 * GET /api/auctions/prized
 *
 * Every seat that has taken the pot, group by group. A seat counts when an
 * auction names it the winner or when the seat is flagged prized, which is how
 * members carried over from the old register arrive. Filters: ?branch, ?groupId.
 *
 * The prize amount is the held auction's when there is one. Carried-over seats
 * have no auction figures, so they show the payout their plan's chit interval
 * schedules for the due they won — the group's scheme and length pick the
 * interval, as they do everywhere else.
 */
export async function GET(request: Request) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const branch = url.searchParams.get("branch")?.trim()
  const groupId = Number(url.searchParams.get("groupId"))

  const where: Prisma.ChitTicketWhereInput = {
    isCompany: false,
    OR: [{ isPrized: true }, { auctionsWon: { some: {} } }],
    ...(Number.isInteger(groupId) && groupId > 0 ? { groupId } : {}),
    group: {
      // AND, so ?branch= narrows the caller's scope and can never widen it.
      AND: [branchScope(auth.user, "branchName"), ...(branch ? [{ branchName: branch }] : [])],
    },
  }

  const tickets = await prisma.chitTicket.findMany({
    where,
    select: {
      id: true,
      ticketNo: true,
      prizedOn: true,
      prizedDue: true,
      group: {
        select: {
          id: true,
          group: true,
          branchName: true,
          amount: true,
          totalTickets: true,
          percentage: true,
        },
      },
      applicant: {
        select: { applicantCode: true, firstName: true, lastName: true, mobile: true },
      },
      auctionsWon: {
        select: { installmentNo: true, prizeAmount: true, auctionDate: true },
        take: 1,
      },
    },
    orderBy: [{ group: { branchName: "asc" } }, { group: { group: "asc" } }, { ticketNo: "asc" }],
  })

  const intervals = await prisma.chitInterval.findMany({
    select: { scheme: true, months: true, rows: { select: { monthNo: true, payout: true } } },
  })
  const payoutFor = new Map(
    intervals.map((i) => [
      `${i.scheme}#${i.months}`,
      new Map(i.rows.map((r) => [r.monthNo, r.payout ?? 0])),
    ])
  )

  const rows: PrizedRecord[] = tickets.map((t) => {
    const win = t.auctionsWon[0]
    const on = t.prizedOn ?? win?.auctionDate ?? null
    const due = win?.installmentNo ?? t.prizedDue ?? null
    const scheduled = due
      ? payoutFor.get(`${t.group.percentage}#${t.group.totalTickets}`)?.get(due) ?? 0
      : 0
    const prize =
      win && win.prizeAmount > 0
        ? { amount: win.prizeAmount, source: "auction" as const }
        : scheduled > 0
          ? { amount: scheduled, source: "interval" as const }
          : { amount: null, source: null }
    return {
      ticketId: t.id,
      groupId: t.group.id,
      group: t.group.group,
      branch: t.group.branchName,
      groupValue: t.group.amount,
      totalTickets: t.group.totalTickets,
      ticketNo: t.ticketNo,
      code: t.applicant?.applicantCode ?? "",
      name: t.applicant
        ? `${t.applicant.firstName} ${t.applicant.lastName}`.trim()
        : "",
      mobile: t.applicant?.mobile ?? "",
      wonRound: due,
      viaAuction: Boolean(win),
      prizedOn: on ? istDay(on) : null,
      prizeAmount: prize.amount,
      prizeSource: prize.source,
    }
  })

  return NextResponse.json(rows)
}
