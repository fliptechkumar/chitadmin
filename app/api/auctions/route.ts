import { NextResponse } from "next/server"
import type { Prisma } from "@/lib/generated/prisma"

import { prisma } from "@/lib/prisma"
import { authorizeApi } from "@/lib/auth-server"
import { branchScope } from "@/lib/rbac"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

/** yyyy-mm-dd in server-local time, matching how ?date= is interpreted. */
function localDay(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate()
  ).padStart(2, "0")}`
}

/**
 * GET /api/auctions
 *
 * The auction register. Filters: ?date (a single day), ?from/?to (a range),
 * ?branch, ?groupId, ?status. With no date filter it returns everything the
 * caller may see, newest first.
 */
export async function GET(request: Request) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const date = url.searchParams.get("date")
  const branch = url.searchParams.get("branch")?.trim()
  const groupId = Number(url.searchParams.get("groupId"))
  const status = url.searchParams.get("status")?.trim()

  // A single date means that whole local day, not an instant.
  let dateFilter: Prisma.DateTimeFilter | undefined
  if (date) {
    const start = new Date(`${date}T00:00:00`)
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      dateFilter = { gte: start, lt: end }
    }
  }

  const where: Prisma.AuctionWhereInput = {
    ...(dateFilter ? { auctionDate: dateFilter } : {}),
    ...(status ? { status: status as Prisma.EnumAuctionStatusFilter["equals"] } : {}),
    ...(Number.isInteger(groupId) && groupId > 0 ? { groupId } : {}),
    group: {
      // AND, not a spread: spreading would let ?branch= overwrite the caller's
      // scope on the same key, handing a Chit Admin any branch they name.
      AND: [
        branchScope(auth.user, "branchName"),
        ...(branch ? [{ branchName: branch }] : []),
      ],
    },
  }

  const auctions = await prisma.auction.findMany({
    where,
    select: {
      id: true,
      installmentNo: true,
      auctionDate: true,
      auctionTime: true,
      prizeAmount: true,
      discount: true,
      dividend: true,
      status: true,
      group: {
        select: {
          id: true,
          group: true,
          branchName: true,
          amount: true,
          startDate: true,
          totalTickets: true,
          // Counts how many seats have already taken the pot, which is what
          // makes a round's position in the chit legible at a glance.
          _count: { select: { tickets: { where: { isPrized: true } } } },
        },
      },
      winnerTicket: {
        select: {
          ticketNo: true,
          applicant: {
            select: { applicantCode: true, firstName: true, lastName: true, mobile: true },
          },
        },
      },
    },
    orderBy: [{ auctionDate: "desc" }, { auctionTime: "asc" }],
  })

  return NextResponse.json(
    auctions.map((a) => ({
      id: a.id,
      branch: a.group.branchName,
      groupId: a.group.id,
      group: a.group.group,
      groupStartDate: a.group.startDate,
      groupValue: a.group.amount,
      totalTickets: a.group.totalTickets,
      installmentNo: a.installmentNo,
      auctionDate: a.auctionDate.toISOString(),
      /**
       * The calendar day the auction falls on, server-local — the same basis
       * ?date= filters by. Sent explicitly because the ISO instant above lands
       * on the previous UTC day for any timezone ahead of UTC, and reading the
       * day off it silently drifts by one.
       */
      auctionDay: localDay(a.auctionDate),
      auctionTime: a.auctionTime,
      prizedCount: a.group._count.tickets,
      prizeAmount: a.prizeAmount,
      discount: a.discount,
      dividend: a.dividend,
      status: a.status,
      winner: a.winnerTicket?.applicant
        ? {
            ticketNo: a.winnerTicket.ticketNo,
            code: a.winnerTicket.applicant.applicantCode,
            name: `${a.winnerTicket.applicant.firstName} ${a.winnerTicket.applicant.lastName}`.trim(),
            mobile: a.winnerTicket.applicant.mobile,
          }
        : null,
    }))
  )
}
