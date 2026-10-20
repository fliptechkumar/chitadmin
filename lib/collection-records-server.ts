import "server-only"

import { activeScheduleFor } from "@/lib/chit-interval-server"
import { prisma } from "@/lib/prisma"
import { canAccessBranch, type Principal } from "@/lib/rbac"
import type { MonthRecord, RecordInput, SeatOption, SeatRecords } from "@/lib/collection-records"

/** A stored instant as the calendar day it falls on for the branches. */
export const dayOf = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })

/** Today, yyyy-mm-dd, on the branches' calendar. */
export const todayIst = () => dayOf(new Date())

/** yyyy-mm-dd as noon UTC, so the day survives any timezone it is read in. */
export const atNoon = (day: string) => new Date(`${day}T12:00:00Z`)

type Denied = { ok: false; status: 403 | 404; error: string }

/** A group the caller may work on, or why not. */
export async function scopedGroup(user: Principal, groupId: number) {
  const group = await prisma.chitGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      group: true,
      branchName: true,
      amount: true,
      totalTickets: true,
      startDate: true,
    },
  })
  if (!group) return { ok: false, status: 404, error: "Group not found." } satisfies Denied
  if (!canAccessBranch(user, group.branchName)) {
    return {
      ok: false,
      status: 403,
      error: `You are not assigned to the ${group.branchName} branch.`,
    } satisfies Denied
  }
  return { ok: true as const, group }
}

/** Seated members of a group — the customers whose records can be kept. */
export async function seatsForGroup(groupId: number): Promise<SeatOption[]> {
  const tickets = await prisma.chitTicket.findMany({
    where: { groupId, applicantId: { not: null }, isCompany: false },
    select: {
      id: true,
      ticketNo: true,
      routeId: true,
      isPrized: true,
      applicant: {
        select: { applicantCode: true, firstName: true, lastName: true, mobile: true },
      },
      _count: { select: { dues: true } },
    },
    orderBy: { ticketNo: "asc" },
  })

  return tickets.map((t) => ({
    ticketId: t.id,
    ticketNo: t.ticketNo,
    name: `${t.applicant?.firstName ?? ""} ${t.applicant?.lastName ?? ""}`.trim(),
    accountNo: t.applicant?.applicantCode ?? "",
    mobile: t.applicant?.mobile ?? "",
    routeId: t.routeId,
    isPrized: t.isPrized,
    saved: t._count.dues,
  }))
}

type Schedule = Awaited<ReturnType<typeof activeScheduleFor>>

/**
 * A seat's ledger with one row per month of the scheme. Saved months come
 * from the database; months not yet saved are filled from the group's
 * schedule — due on the start day of each month, at the monthly share less
 * that round's dividend once its auction is held — with nothing collected.
 *
 * Pure, so a caller listing many seats can load each group's schedule once.
 */
export function ledgerFor(input: {
  group: { amount: number; totalTickets: number; startDate: string }
  dividends: { installmentNo: number; dividend: number }[]
  schedule: Schedule
  saved: {
    installmentNo: number
    dueDate: Date
    amountDue: number
    amountPaid: number
    paidOn: Date | null
    routeId: number | null
  }[]
  seatRouteId: number | null
}): MonthRecord[] {
  const { group: g, schedule } = input
  const months = Math.max(1, g.totalTickets)
  const share = Math.round(g.amount / months)
  const dividend = new Map(input.dividends.map((a) => [a.installmentNo, a.dividend]))
  const saved = new Map(input.saved.map((d) => [d.installmentNo, d]))

  // Months are dated from the group's own start date.
  const [sd, sm, sy] = g.startDate.split("/").map(Number)

  /** The configured instalment for a month, or null with no schedule. */
  const scheduledDue = (k: number) => schedule?.installment.get(k) ?? null

  return Array.from({ length: months }, (_, i) => {
    const installmentNo = i + 1
    const row = saved.get(installmentNo)
    if (row) {
      return {
        installmentNo,
        dueDate: dayOf(row.dueDate),
        amountDue: row.amountDue,
        scheduledDue: scheduledDue(installmentNo),
        amount: row.amountPaid,
        date: row.paidOn ? dayOf(row.paidOn) : null,
        routeId: row.routeId ?? input.seatRouteId,
        saved: true,
      }
    }

    const due = sd && sm && sy ? new Date(sy, sm - 1 + i, sd) : new Date()
    return {
      installmentNo,
      dueDate: `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`,
      // The scheme's schedule when configured; otherwise the share less the
      // round's auction dividend.
      amountDue:
        scheduledDue(installmentNo) ??
        Math.max(0, share - (dividend.get(installmentNo) ?? 0)),
      scheduledDue: scheduledDue(installmentNo),
      amount: 0,
      date: null,
      routeId: input.seatRouteId,
      saved: false,
    }
  })
}

/** A seat's full ledger, after checking the caller may see its branch. */
export async function loadSeatRecords(
  user: Principal,
  ticketId: number
): Promise<SeatRecords | Denied> {
  const ticket = await prisma.chitTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      ticketNo: true,
      routeId: true,
      isPrized: true,
      isCompany: true,
      applicant: {
        select: { applicantCode: true, firstName: true, lastName: true, mobile: true },
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
          auctions: {
            where: { status: "completed" },
            select: { installmentNo: true, dividend: true },
          },
        },
      },
      dues: {
        select: {
          installmentNo: true,
          dueDate: true,
          amountDue: true,
          amountPaid: true,
          paidOn: true,
          routeId: true,
        },
      },
    },
  })

  if (!ticket || !ticket.applicant || ticket.isCompany) {
    return { ok: false, status: 404, error: "Customer seat not found." }
  }
  if (!canAccessBranch(user, ticket.group.branchName)) {
    return {
      ok: false,
      status: 403,
      error: `You are not assigned to the ${ticket.group.branchName} branch.`,
    }
  }

  const g = ticket.group
  const months = Math.max(1, g.totalTickets)
  const schedule = await activeScheduleFor(g)
  const records = ledgerFor({
    group: g,
    dividends: g.auctions,
    schedule,
    saved: ticket.dues,
    seatRouteId: ticket.routeId,
  })

  return {
    seat: {
      ticketId: ticket.id,
      ticketNo: ticket.ticketNo,
      name: `${ticket.applicant.firstName} ${ticket.applicant.lastName}`.trim(),
      accountNo: ticket.applicant.applicantCode,
      mobile: ticket.applicant.mobile,
      routeId: ticket.routeId,
      isPrized: ticket.isPrized,
      saved: ticket.dues.length,
      group: g.group,
      groupId: g.id,
      branch: g.branchName,
      chitValue: g.amount,
      months,
    },
    schedule: schedule ? { intervalId: schedule.id, scheme: schedule.scheme } : null,
    records,
  }
}

/**
 * Writes every month of a seat's ledger in one transaction. Upserts on
 * (ticket, instalment), so saving twice updates rather than duplicates.
 *
 * New months take their due amount from the scheme's schedule. An existing
 * month keeps its due amount unless `applySchedule` is set — the user asking
 * for the configured schedule to replace what was saved before.
 */
export async function saveSeatRecords(
  ticketId: number,
  current: SeatRecords,
  input: RecordInput[],
  applySchedule = false
) {
  const intervalId = current.schedule?.intervalId ?? null
  const scheduled = new Map(current.records.map((r) => [r.installmentNo, r]))

  await prisma.$transaction(
    input.map((r) => {
      const plan = scheduled.get(r.installmentNo)!
      const collected = {
        amountPaid: r.amount,
        paidOn: r.date ? atNoon(r.date) : null,
        routeId: r.routeId,
      }
      return prisma.ticketDue.upsert({
        where: { ticketId_installmentNo: { ticketId, installmentNo: r.installmentNo } },
        create: {
          ticketId,
          installmentNo: r.installmentNo,
          dueDate: atNoon(plan.dueDate),
          amountDue: plan.amountDue,
          intervalId: plan.scheduledDue !== null ? intervalId : null,
          ...collected,
        },
        update:
          applySchedule && plan.scheduledDue !== null
            ? { ...collected, amountDue: plan.scheduledDue, intervalId }
            : collected,
      })
    })
  )
}
