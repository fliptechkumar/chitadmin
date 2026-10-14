import "server-only"

import { NextResponse } from "next/server"

import type { Prisma } from "@/lib/generated/prisma"
import { prisma } from "@/lib/prisma"
import { branchScope, type Principal } from "@/lib/rbac"
import { UNASSIGNED, isIsoDay } from "@/lib/denomination"
import { statusOf, type AdvanceReport, type AdvanceRow } from "@/lib/advance-preparation"

export type AdvanceQuery = {
  /** yyyy-mm-dd, inclusive. */
  from: string
  to: string
  branch?: string
  /** A route id, UNASSIGNED, or empty for every route. */
  route?: string
}

/** A year of instalments is the widest period the sheet is meant for. */
const MAX_DAYS = 366

/** Reads ?from&to&branch&route, or returns the 400 to send back. */
export function parseAdvanceQuery(
  url: URL
): { ok: true; query: AdvanceQuery } | { ok: false; response: NextResponse } {
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")

  if (!isIsoDay(from) || !isIsoDay(to)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Pick a from and to date." }, { status: 400 }),
    }
  }
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000
  if (days < 0 || days > MAX_DAYS) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "The period must run forwards and span at most a year." },
        { status: 400 }
      ),
    }
  }

  return {
    ok: true,
    query: {
      from,
      to,
      branch: url.searchParams.get("branch")?.trim() || undefined,
      route: url.searchParams.get("route")?.trim() || undefined,
    },
  }
}

/** A stored instant as the calendar day it falls on for the branches. */
const dayOf = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })

/** dd/MM/yyyy → yyyy-mm-dd, or "" if malformed. */
function displayToIso(value: string) {
  const [d, m, y] = value.split("/")
  return d && m && y ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : ""
}

const nameKey = (group: string, name: string) =>
  `${group}|${name.trim().replace(/\s+/g, " ").toLowerCase()}`

/**
 * What every seated subscriber owes for a period — the sheet a collection
 * executive takes out on the round.
 *
 * Seats with an instalment ledger (TicketDue) are read from it. Seats without
 * one — imported members whose ledger has not been built — are worked out from
 * the group's schedule: one instalment a month from the start date, the
 * monthly share less that round's dividend once the auction is held, with
 * payments taken from the period's paid receipts. Those rows are flagged as
 * estimated, and carry no arrears figure because there is no history to read.
 */
export async function buildAdvanceReport(
  user: Principal,
  query: AdvanceQuery
): Promise<AdvanceReport> {
  const where: Prisma.ChitTicketWhereInput = {
    applicantId: { not: null },
    isCompany: false,
    group: {
      AND: [
        branchScope(user, "branchName"),
        ...(query.branch ? [{ branchName: query.branch }] : []),
      ],
    },
    ...(query.route === UNASSIGNED
      ? { routeId: null }
      : query.route
        ? { routeId: Number(query.route) || -1 }
        : {}),
  }

  const tickets = await prisma.chitTicket.findMany({
    where,
    select: {
      id: true,
      ticketNo: true,
      isPrized: true,
      collectionType: true,
      routeId: true,
      route: {
        select: {
          code: true,
          executives: {
            select: { employee: { select: { name: true } } },
            orderBy: { position: "asc" },
            take: 1,
          },
        },
      },
      applicant: {
        select: {
          applicantCode: true,
          firstName: true,
          lastName: true,
          mobile: true,
          area: true,
          introducerName: true,
          assignedTo: { select: { name: true } },
        },
      },
      group: {
        select: {
          id: true,
          group: true,
          branchName: true,
          amount: true,
          totalTickets: true,
          startDate: true,
          percentage: true,
        },
      },
      dues: {
        select: { installmentNo: true, dueDate: true, amountDue: true, amountPaid: true },
        orderBy: { installmentNo: "asc" },
      },
    },
    orderBy: [{ route: { code: "asc" } }, { groupId: "asc" }, { ticketNo: "asc" }],
  })

  // Only seats without a ledger need the schedule and receipts.
  const unledgered = tickets.filter((t) => t.dues.length === 0)
  const groupIds = [...new Set(unledgered.map((t) => t.group.id))]
  const groupNames = [...new Set(unledgered.map((t) => t.group.group))]

  const schemes = [...new Set(unledgered.map((t) => t.group.percentage))]

  const [auctions, receipts, intervals] = await Promise.all([
    groupIds.length
      ? prisma.auction.findMany({
          where: { groupId: { in: groupIds }, status: "completed" },
          select: { groupId: true, installmentNo: true, dividend: true },
        })
      : [],
    groupNames.length
      ? prisma.collection.findMany({
          where: { group: { in: groupNames }, status: "paid" },
          select: { group: true, customerName: true, amount: true, date: true },
        })
      : [],
    schemes.length
      ? prisma.chitInterval.findMany({
          where: { scheme: { in: schemes }, status: "active" },
          select: { scheme: true, months: true, rows: { select: { monthNo: true, installment: true } } },
        })
      : [],
  ])

  /** Configured instalments by "<scheme>|<months>|<month no>". */
  const scheduled = new Map(
    intervals.flatMap((i) => i.rows.map((r) => [`${i.scheme}|${i.months}|${r.monthNo}`, r.installment] as const))
  )

  const dividendOf = new Map(
    auctions.map((a) => [`${a.groupId}|${a.installmentNo}`, a.dividend])
  )

  const paidInPeriod = new Map<string, number>()
  for (const r of receipts) {
    const day = displayToIso(r.date)
    if (!day || day < query.from || day > query.to) continue
    const key = nameKey(r.group, r.customerName)
    paidInPeriod.set(key, (paidInPeriod.get(key) ?? 0) + r.amount)
  }

  const seatsByName = new Map<string, number>()
  for (const t of unledgered) {
    const key = nameKey(t.group.group, `${t.applicant?.firstName ?? ""} ${t.applicant?.lastName ?? ""}`)
    seatsByName.set(key, (seatsByName.get(key) ?? 0) + 1)
  }

  const rows: AdvanceRow[] = tickets.map((t) => {
    const name = `${t.applicant?.firstName ?? ""} ${t.applicant?.lastName ?? ""}`.trim()

    let dueDate: string | null = null
    let installmentNo: number | null = null
    let due = 0
    let paid = 0
    let arrearsCount: number | null = null
    let arrearsAmount: number | null = null
    const estimated = t.dues.length === 0

    if (!estimated) {
      const inPeriod = t.dues.filter((d) => {
        const day = dayOf(d.dueDate)
        return day >= query.from && day <= query.to
      })
      const earlier = t.dues.filter(
        (d) => dayOf(d.dueDate) < query.from && d.amountPaid < d.amountDue
      )
      dueDate = inPeriod[0] ? dayOf(inPeriod[0].dueDate) : null
      installmentNo = inPeriod.at(-1)?.installmentNo ?? null
      due = inPeriod.reduce((s, d) => s + d.amountDue, 0)
      paid = inPeriod.reduce((s, d) => s + d.amountPaid, 0)
      arrearsCount = earlier.length
      arrearsAmount = earlier.reduce((s, d) => s + d.amountDue - d.amountPaid, 0)
    } else {
      const [sd, sm, sy] = t.group.startDate.split("/").map(Number)
      if (sd && sm && sy && t.group.totalTickets > 0) {
        const share = Math.round(t.group.amount / t.group.totalTickets)
        for (let k = 1; k <= t.group.totalTickets; k++) {
          const d = new Date(sy, sm - 1 + (k - 1), sd)
          const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
          if (day > query.to) break
          if (day < query.from) continue
          dueDate ??= day
          installmentNo = k
          // The scheme's chit interval when one is configured; otherwise the
          // share less the round's auction dividend.
          due +=
            scheduled.get(`${t.group.percentage}|${t.group.totalTickets}|${k}`) ??
            Math.max(0, share - (dividendOf.get(`${t.group.id}|${k}`) ?? 0))
        }
      }
      // Receipts name the member, not the seat. Someone holding two seats in
      // one group has their payments fill each seat's due in turn, so the
      // same money is never counted twice; any surplus stays on the last.
      const key = nameKey(t.group.group, name)
      const remaining = paidInPeriod.get(key) ?? 0
      const seatsLeft = (seatsByName.get(key) ?? 1) - 1
      seatsByName.set(key, seatsLeft)
      paid = seatsLeft > 0 ? Math.min(remaining, due) : remaining
      paidInPeriod.set(key, remaining - paid)
    }

    return {
      ticketId: t.id,
      branch: t.group.branchName,
      routeId: t.routeId,
      routeCode: t.route?.code ?? "—",
      accountNo: t.applicant?.applicantCode ?? "",
      name,
      mobile: t.applicant?.mobile ?? "",
      area: t.applicant?.area ?? "",
      group: t.group.group,
      ticketNo: t.ticketNo,
      chitValue: t.group.amount,
      isPrized: t.isPrized,
      collectionType: t.collectionType,
      dueDate,
      installmentNo,
      due,
      paid,
      arrearsCount,
      arrearsAmount,
      status: statusOf(due, paid),
      staff:
        t.applicant?.introducerName ||
        t.applicant?.assignedTo?.name ||
        t.route?.executives[0]?.employee.name ||
        "",
      estimated,
    }
  })

  return { from: query.from, to: query.to, rows }
}
