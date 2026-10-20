import "server-only"

import { prisma } from "@/lib/prisma"
import { branchScope, type Principal } from "@/lib/rbac"
import { todayIst } from "@/lib/collection-records-server"
import { loadFirstDues } from "@/lib/first-dues"

/**
 * Live figures for the dashboard, scoped to the caller's branches.
 *
 * Money comes from two places that are entered separately: the monthly ledger
 * (TicketDue, filled from Collection records) and receipts (Collection, written
 * by the mobile app). Only paid receipts count as collected.
 */

/** yyyy-mm-dd → the instant that day starts in India. */
const istStart = (day: string) => new Date(`${day}T00:00:00+05:30`)

/** First day of the month `offset` months from (year, month1). */
function monthStart(year: number, month1: number, offset: number) {
  const d = new Date(Date.UTC(year, month1 - 1 + offset, 1))
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  return { y, m, day: `${y}-${String(m).padStart(2, "0")}-01` }
}

const MONTH_LABEL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "dd/mm/yyyy" receipt day → yyyy-mm-dd, so receipts sort with ledger rows. */
const receiptDay = (date: string) => {
  const [d, m, y] = date.split("/")
  return `${y}-${m}-${d}`
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>

export async function loadDashboard(user: Principal) {
  const today = todayIst()
  const [ty, tm] = today.split("-").map(Number)
  const tomorrow = new Date(istStart(today).getTime() + 86_400_000)

  const groupScope = branchScope(user, "branchName")
  const dueScope = { ticket: { group: groupScope } }

  const scopedGroups = await prisma.chitGroup.findMany({ where: groupScope, select: { group: true } })
  const receiptScope = {
    status: "paid" as const,
    ...(user.role === "SUPER_ADMIN" ? {} : { group: { in: [...new Set(scopedGroups.map((g) => g.group))] } }),
  }

  // Six months ending with this one, oldest first.
  const months = Array.from({ length: 6 }, (_, i) => {
    const start = monthStart(ty, tm, i - 5)
    const end = monthStart(ty, tm, i - 4)
    return { ...start, from: istStart(start.day), to: istStart(end.day) }
  })
  const thisMonth = months[5]

  const sumPaid = (where: object) =>
    prisma.ticketDue.aggregate({ where: { ...dueScope, ...where }, _sum: { amountPaid: true, amountDue: true } })
  const sumReceipts = (where: object) =>
    prisma.collection.aggregate({ where: { ...receiptScope, ...where }, _sum: { amount: true, penalty: true } })

  const [
    groupCounts,
    seats,
    holders,
    ledgerAll,
    receiptsAll,
    ledgerMonths,
    receiptMonths,
    ledgerToday,
    receiptsToday,
    dueThisMonth,
    dueToDate,
    overdue,
    activeGroups,
    recentLedger,
    recentReceipts,
    firstDues,
  ] = await Promise.all([
    prisma.chitGroup.groupBy({ by: ["status"], where: groupScope, _count: true }),
    prisma.chitTicket.groupBy({
      by: ["isCompany"],
      where: { group: { ...groupScope, status: "active" } },
      _count: { _all: true, applicantId: true },
    }),
    prisma.chitTicket.groupBy({
      by: ["applicantId"],
      where: { group: { ...groupScope, status: "active" }, applicantId: { not: null } },
    }),
    sumPaid({}),
    sumReceipts({}),
    Promise.all(months.map((m) => sumPaid({ paidOn: { gte: m.from, lt: m.to } }))),
    Promise.all(
      months.map((m) => sumReceipts({ date: { endsWith: `/${String(m.m).padStart(2, "0")}/${m.y}` } }))
    ),
    sumPaid({ paidOn: { gte: istStart(today), lt: tomorrow } }),
    sumReceipts({ date: today.split("-").reverse().join("/") }),
    sumPaid({ dueDate: { gte: thisMonth.from, lt: thisMonth.to } }),
    sumPaid({ dueDate: { lt: tomorrow } }),
    // Months already due and not fully paid: what is owed is due − paid.
    sumPaid({ dueDate: { lt: tomorrow }, amountPaid: { lt: prisma.ticketDue.fields.amountDue } }),
    prisma.chitGroup.findMany({
      where: { ...groupScope, status: "active" },
      select: { id: true, group: true, branchName: true, amount: true, vacants: true, members: true, totalTickets: true },
      orderBy: [{ vacants: "desc" }, { group: "asc" }],
      take: 5,
    }),
    prisma.ticketDue.findMany({
      where: { ...dueScope, amountPaid: { gt: 0 }, paidOn: { not: null } },
      select: {
        id: true,
        installmentNo: true,
        amountPaid: true,
        amountDue: true,
        paidOn: true,
        route: { select: { code: true } },
        ticket: {
          select: {
            group: { select: { group: true } },
            applicant: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ paidOn: "desc" }, { updatedAt: "desc" }],
      take: 6,
    }),
    prisma.collection.findMany({
      where: { ...receiptScope, status: undefined },
      select: { id: true, receiptNo: true, customerName: true, group: true, installment: true, amount: true, mode: true, status: true, date: true },
      orderBy: { id: "desc" },
      take: 6,
    }),
    loadFirstDues(user, ty, tm),
  ])

  const statusCount = (s: string) => groupCounts.find((g) => g.status === s)?._count ?? 0
  const totalSeats = seats.reduce((s, r) => s + r._count._all, 0)
  const filledSeats = seats.reduce((s, r) => s + (r.isCompany ? r._count._all : r._count.applicantId), 0)

  const monthly = months.map((m, i) => ({
    month: MONTH_LABEL[m.m - 1],
    amount: (ledgerMonths[i]._sum.amountPaid ?? 0) + (receiptMonths[i]._sum.amount ?? 0),
  }))
  const monthCollected = monthly[5].amount
  const lastMonthCollected = monthly[4].amount

  const recent = [
    ...recentLedger.map((d) => ({
      key: `L${d.id}`,
      day: d.paidOn!.toISOString().slice(0, 10),
      ref: `Month ${d.installmentNo}${d.route ? ` · ${d.route.code}` : ""}`,
      customer: `${d.ticket.applicant?.firstName ?? ""} ${d.ticket.applicant?.lastName ?? ""}`.trim() || "—",
      group: d.ticket.group.group,
      amount: d.amountPaid,
      source: "Ledger",
      status: d.amountPaid >= d.amountDue ? "paid" : "part paid",
    })),
    ...recentReceipts.map((c) => ({
      key: `R${c.id}`,
      day: receiptDay(c.date),
      ref: c.receiptNo,
      customer: c.customerName,
      group: c.group,
      amount: c.amount,
      source: c.mode,
      status: c.status as string,
    })),
  ]
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, 6)

  const owed = (overdue._sum.amountDue ?? 0) - (overdue._sum.amountPaid ?? 0)

  return {
    today,
    totalCollected: (ledgerAll._sum.amountPaid ?? 0) + (receiptsAll._sum.amount ?? 0),
    activeGroups: statusCount("active"),
    upcomingGroups: statusCount("upcoming"),
    customers: holders.length,
    totalSeats,
    filledSeats,
    pendingDues: Math.max(0, owed),
    monthly,
    monthCollected,
    lastMonthCollected,
    monthDue: dueThisMonth._sum.amountDue ?? 0,
    monthDuePaid: dueThisMonth._sum.amountPaid ?? 0,
    dueToDate: dueToDate._sum.amountDue ?? 0,
    paidToDate: dueToDate._sum.amountPaid ?? 0,
    todayCollected: (ledgerToday._sum.amountPaid ?? 0) + (receiptsToday._sum.amount ?? 0),
    todayPenalties: receiptsToday._sum.penalty ?? 0,
    activeGroupList: activeGroups,
    recent,
    firstDues,
    monthLabel: `${MONTH_LABEL[tm - 1]} ${ty}`,
  }
}
