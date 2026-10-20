import "server-only"

import { activeScheduleFor } from "@/lib/chit-interval-server"
import { prisma } from "@/lib/prisma"
import { branchScope, type Principal } from "@/lib/rbac"

/**
 * Groups whose first instalment falls in the given month, with how the seats
 * are filled and how much of that instalment has come in.
 *
 * A group's first instalment is due on its start date. Members whose month-one
 * row has not been saved yet are expected to pay what the ledger would show
 * for it: the scheme's schedule when one is configured, otherwise the monthly
 * share less any dividend from the first auction.
 */
export async function loadFirstDues(user: Principal, year: number, month1: number) {
  const suffix = `/${String(month1).padStart(2, "0")}/${year}`

  const groups = await prisma.chitGroup.findMany({
    where: {
      ...branchScope(user, "branchName"),
      status: { in: ["active", "upcoming"] },
      startDate: { endsWith: suffix },
    },
    select: {
      id: true,
      group: true,
      branchName: true,
      percentage: true,
      amount: true,
      startDate: true,
      totalTickets: true,
      auctions: {
        where: { installmentNo: 1, status: "completed" },
        select: { dividend: true },
      },
      tickets: {
        select: {
          applicantId: true,
          isCompany: true,
          dues: {
            where: { installmentNo: 1 },
            select: { amountDue: true, amountPaid: true },
          },
        },
      },
    },
  })

  // Groups on the same plan share a schedule, so look each one up once.
  const schedules = new Map<string, Awaited<ReturnType<typeof activeScheduleFor>>>()
  for (const g of groups) {
    const key = `${g.percentage}|${g.totalTickets}`
    if (!schedules.has(key)) schedules.set(key, await activeScheduleFor(g))
  }

  return groups
    .map((g) => {
      const schedule = schedules.get(`${g.percentage}|${g.totalTickets}`)
      const share = Math.round(g.amount / Math.max(1, g.totalTickets))
      const installment =
        schedule?.installment.get(1) ?? Math.max(0, share - (g.auctions[0]?.dividend ?? 0))

      const members = g.tickets.filter((t) => !t.isCompany && t.applicantId !== null)
      const company = g.tickets.filter((t) => t.isCompany).length

      let expected = 0
      let collected = 0
      let paidMembers = 0
      for (const t of members) {
        const due = t.dues[0]
        const amountDue = due?.amountDue ?? installment
        const amountPaid = due?.amountPaid ?? 0
        expected += amountDue
        collected += amountPaid
        if (amountDue > 0 && amountPaid >= amountDue) paidMembers += 1
      }

      const [d, m, y] = g.startDate.split("/")
      return {
        id: g.id,
        group: g.group,
        branchName: g.branchName,
        chitValue: g.amount,
        startDay: `${y}-${m}-${d}`,
        installment,
        seats: {
          total: g.totalTickets,
          filled: members.length,
          company,
          vacant: Math.max(0, g.totalTickets - members.length - company),
        },
        expected,
        collected,
        paidMembers,
      }
    })
    .sort((a, b) => a.startDay.localeCompare(b.startDay) || a.group.localeCompare(b.group))
}

export type FirstDueGroup = Awaited<ReturnType<typeof loadFirstDues>>[number]
