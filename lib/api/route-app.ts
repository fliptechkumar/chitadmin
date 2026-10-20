import "server-only"

import type { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { getCompany } from "@/lib/company"
import { activeScheduleFor } from "@/lib/chit-interval-server"
import { atNoon, ledgerFor, todayIst } from "@/lib/collection-records-server"
import type { MonthRecord } from "@/lib/collection-records"
import { isoToDisplay } from "@/lib/denomination"
import { positionFor } from "@/lib/dues"
import { authenticateBearer, type ApiUser } from "./auth"
import { apiError } from "./response"

/**
 * Server side of the route collection app. Every endpoint under
 * /api/v1/route/* is for a route's own login only, and only ever sees the
 * seats on that route.
 *
 * Money is recorded in two places in one transaction: the seat's monthly
 * ledger (TicketDue), which the dues register and Collection Records read,
 * and a Collection row, which is the receipt and feeds the day's cash for the
 * denomination report.
 */

export type RouteRef = { id: number; code: string; name: string; branch: string }

export type RouteAuth =
  | { ok: true; user: ApiUser; route: RouteRef }
  | { ok: false; response: NextResponse }

export async function authenticateRoute(request: Request): Promise<RouteAuth> {
  const auth = await authenticateBearer(request, ["ROUTE"])
  if (!auth.ok) return auth
  if (!auth.user.route) {
    return {
      ok: false,
      response: apiError("FORBIDDEN", "This app is for route logins only."),
    }
  }
  return { ok: true, user: auth.user, route: auth.user.route }
}

// ---------------------------------------------------------------------------
// Members: the seats on a route, with where each stands
// ---------------------------------------------------------------------------

/** How the app labels a member. "paid" includes paid in advance. */
export type MemberStatus = "paid" | "due" | "overdue"

export type RouteMember = {
  ticketId: number
  ticketNo: number
  name: string
  accountNo: string
  mobile: string
  area: string
  groupId: number
  group: string
  chitValue: number
  months: number
  isPrized: boolean
  status: MemberStatus
  /** The month being collected now (latest whose date has passed). */
  currentInstallment: number
  /** That month's instalment. */
  monthlyDue: number
  /** Still owed on that month alone. */
  currentDue: number
  /** Still owed on months whose date has passed. */
  outstanding: number
  /** Earlier months still short, besides the current one. */
  pendingMonths: number
  paidToDate: number
  /** Oldest month still short, yyyy-mm-dd; null once every month is paid. */
  nextDueDate: string | null
}

const SEAT_SELECT = {
  id: true,
  ticketNo: true,
  routeId: true,
  isPrized: true,
  applicant: {
    select: {
      applicantCode: true,
      firstName: true,
      lastName: true,
      mobile: true,
      area: true,
      city: true,
      addressLine1: true,
      addressLine2: true,
      pincode: true,
      introducerName: true,
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
      status: true,
      auctions: {
        where: { status: "completed" as const },
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
}

type SeatRow = NonNullable<Awaited<ReturnType<typeof loadSeat>>>

function loadSeat(ticketId: number, routeId: number) {
  return prisma.chitTicket.findFirst({
    where: { id: ticketId, routeId, applicantId: { not: null }, isCompany: false },
    select: SEAT_SELECT,
  })
}

/** Loads each group's chit interval once, however many seats share it. */
function scheduleCache() {
  const cache = new Map<string, ReturnType<typeof activeScheduleFor>>()
  return (g: { percentage: string; totalTickets: number }) => {
    const key = `${g.percentage}|${g.totalTickets}`
    let hit = cache.get(key)
    if (!hit) {
      hit = activeScheduleFor(g)
      cache.set(key, hit)
    }
    return hit
  }
}

async function ledgerOf(seat: SeatRow, schedules = scheduleCache()) {
  return ledgerFor({
    group: seat.group,
    dividends: seat.group.auctions,
    schedule: await schedules(seat.group),
    saved: seat.dues,
    seatRouteId: seat.routeId,
  })
}

/** "2026-10-20" for a Date read as an IST calendar day. */
const istDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })

function summarize(seat: SeatRow, records: MonthRecord[]): RouteMember {
  // positionFor compares due dates with "now"; noon UTC keeps a due date on
  // the same calendar day in India.
  const today = atNoon(todayIst())
  const position = positionFor(
    records.map((r) => ({
      installmentNo: r.installmentNo,
      dueDate: `${r.dueDate}T12:00:00Z`,
      amountDue: r.amountDue,
      amountPaid: r.amount,
    })),
    today
  )
  const current = position.current
  const short = records.find((r) => r.amount < r.amountDue)

  let status: MemberStatus = "paid"
  if (position.pendingCount > 0) status = "overdue"
  else if (position.status === "pending" || position.status === "part_paid") status = "due"

  const a = seat.applicant!
  return {
    ticketId: seat.id,
    ticketNo: seat.ticketNo,
    name: `${a.firstName} ${a.lastName}`.trim(),
    accountNo: a.applicantCode,
    mobile: a.mobile,
    area: a.area || a.city || "",
    groupId: seat.group.id,
    group: seat.group.group,
    chitValue: seat.group.amount,
    months: Math.max(1, seat.group.totalTickets),
    isPrized: seat.isPrized,
    status,
    currentInstallment: current?.installmentNo ?? 1,
    monthlyDue: current?.amountDue ?? 0,
    currentDue: current ? Math.max(0, current.amountDue - current.amountPaid) : 0,
    outstanding: position.outstanding,
    pendingMonths: position.pendingCount,
    paidToDate: position.paidToDate,
    nextDueDate: short?.dueDate ?? null,
  }
}

/** Every seated member on the route, ordered by group then seat. */
export async function routeMembers(routeId: number): Promise<RouteMember[]> {
  const seats = await prisma.chitTicket.findMany({
    where: { routeId, applicantId: { not: null }, isCompany: false, status: "active" },
    select: SEAT_SELECT,
    orderBy: [{ group: { group: "asc" } }, { ticketNo: "asc" }],
  })
  const schedules = scheduleCache()
  return Promise.all(seats.map(async (s) => summarize(s, await ledgerOf(s, schedules))))
}

export type MonthStatus = "paid" | "partial" | "overdue" | "due" | "upcoming" | "advance"

export async function routeMemberDetail(routeId: number, ticketId: number) {
  const seat = await loadSeat(ticketId, routeId)
  if (!seat) return null

  const records = await ledgerOf(seat)
  const member = summarize(seat, records)
  const today = todayIst()
  const a = seat.applicant!

  const [receipts, prize] = await Promise.all([
    prisma.collection.findMany({
      where: { ticketId: seat.id },
      select: RECEIPT_ROW_SELECT,
      orderBy: { id: "desc" },
      take: 10,
    }),
    prisma.auction.findFirst({
      where: { winnerTicketId: seat.id, status: "completed" },
      select: { installmentNo: true, prizeAmount: true, auctionDate: true },
    }),
  ])

  return {
    member: {
      ...member,
      branch: seat.group.branchName,
      address: [a.addressLine1, a.addressLine2, a.area, a.city, a.pincode]
        .filter(Boolean)
        .join(", "),
      introducer: a.introducerName ?? "",
    },
    prize: prize
      ? {
          installmentNo: prize.installmentNo,
          amount: prize.prizeAmount,
          date: prize.auctionDate.toISOString(),
        }
      : null,
    records: records.map((r) => {
      const status: MonthStatus =
        r.amount >= r.amountDue && r.amountDue > 0
          ? r.dueDate > today
            ? "advance"
            : "paid"
          : r.amount > 0
            ? "partial"
            : r.dueDate > today
              ? "upcoming"
              : r.installmentNo < member.currentInstallment
                ? "overdue"
                : "due"
      return {
        installmentNo: r.installmentNo,
        dueDate: r.dueDate,
        amountDue: r.amountDue,
        amountPaid: r.amount,
        paidOn: r.date,
        status,
      }
    }),
    receipts: receipts.map(receiptRow),
  }
}

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------

export const RECEIPT_ROW_SELECT = {
  id: true,
  receiptNo: true,
  ticketId: true,
  customerName: true,
  group: true,
  installment: true,
  amount: true,
  penalty: true,
  mode: true,
  date: true,
  reference: true,
  createdAt: true,
  ticket: { select: { ticketNo: true } },
} as const

type ReceiptRowInput = {
  id: number
  receiptNo: string
  ticketId: number | null
  customerName: string
  group: string
  installment: number
  amount: number
  penalty: number
  mode: string
  date: string
  reference: string | null
  createdAt: Date
  ticket: { ticketNo: number } | null
}

/** One line of the day statement or a member's recent payments. */
export function receiptRow(c: ReceiptRowInput) {
  return {
    id: c.id,
    receiptNo: c.receiptNo,
    ticketId: c.ticketId,
    name: c.customerName,
    group: c.group,
    ticketNo: c.ticket?.ticketNo ?? null,
    installment: c.installment,
    amount: c.amount + c.penalty,
    mode: c.mode,
    reference: c.reference ?? "",
    /** dd/MM/yyyy, the business day it counts towards. */
    date: c.date,
    /** ISO instant it was written. */
    createdAt: c.createdAt.toISOString(),
  }
}

/** Everything the receipt screen and the printed slip show. */
export async function routeReceipt(routeId: number, collectionId: number) {
  const c = await prisma.collection.findFirst({
    where: { id: collectionId, routeId },
    select: {
      ...RECEIPT_ROW_SELECT,
      note: true,
      collectedBy: true,
      route: { select: { code: true, name: true, branch: true } },
      ticket: {
        select: {
          ticketNo: true,
          applicant: { select: { applicantCode: true, mobile: true } },
        },
      },
    },
  })
  if (!c) return null

  const [company, detail] = await Promise.all([
    getCompany(),
    c.ticketId ? routeMemberDetail(routeId, c.ticketId) : null,
  ])

  return {
    ...receiptRow(c),
    note: c.note ?? "",
    collectedBy: c.collectedBy,
    accountNo: c.ticket?.applicant?.applicantCode ?? "",
    mobile: c.ticket?.applicant?.mobile ?? "",
    route: c.route,
    company: {
      name: company.name,
      shortName: company.shortName,
      phone: company.phone,
      address: [company.addressLine, company.city, company.state, company.pincode]
        .filter(Boolean)
        .join(", "),
    },
    /** Still owed on the seat now, after this and any later payments. */
    balance: detail?.member.outstanding ?? 0,
    monthlyDue: detail?.member.monthlyDue ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Recording a payment
// ---------------------------------------------------------------------------

export const APP_MODES = ["cash", "online", "cheque"] as const
export type AppMode = (typeof APP_MODES)[number]

export type CollectInput = {
  ticketId: number
  amount: number
  mode: AppMode
  reference: string
  note: string
}

/** Guards against a typo adding a crore to someone's receipt. */
const MAX_AMOUNT = 10_000_000

export function parseCollectInput(
  raw: unknown
): { ok: true; data: CollectInput } | { ok: false; fields: Record<string, string> } {
  const body = (raw ?? {}) as Record<string, unknown>
  const fields: Record<string, string> = {}

  const ticketId = Number(body.ticketId)
  if (!Number.isInteger(ticketId) || ticketId < 1) fields.ticketId = "Select a member"

  const amount = Number(body.amount)
  if (!Number.isInteger(amount) || amount < 1) fields.amount = "Enter an amount of at least ₹1"
  else if (amount > MAX_AMOUNT) fields.amount = "Amount looks too large — check the value"

  const mode = body.mode as AppMode
  if (!APP_MODES.includes(mode)) fields.mode = "Select a payment mode"

  const reference = typeof body.reference === "string" ? body.reference.trim().slice(0, 64) : ""
  if (mode !== "cash" && APP_MODES.includes(mode) && reference.length < 4) {
    fields.reference = "Enter the UTR or cheque number"
  }

  const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : ""

  if (Object.keys(fields).length) return { ok: false, fields }
  return { ok: true, data: { ticketId, amount, mode, reference, note } }
}

export class CollectError extends Error {
  constructor(
    message: string,
    readonly field?: string
  ) {
    super(message)
  }
}

/**
 * Credits a payment to the seat's ledger, oldest unpaid month first and on
 * into later months as an advance, and writes the receipt. The seat row is
 * locked first, so two phones collecting from the same member at once cannot
 * both credit the same month.
 */
export async function recordRoutePayment(
  user: ApiUser,
  route: RouteRef,
  input: CollectInput
) {
  const seatCheck = await loadSeat(input.ticketId, route.id)
  if (!seatCheck) throw new CollectError("This member is not on your route.", "ticketId")
  const schedule = await activeScheduleFor(seatCheck.group)
  const today = todayIst()

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "ChitTicket" WHERE "id" = ${input.ticketId} FOR UPDATE`

    // Re-read the dues under the lock; the copy above may already be stale.
    const dues = await tx.ticketDue.findMany({
      where: { ticketId: input.ticketId },
      select: SEAT_SELECT.dues.select,
    })
    const records = ledgerFor({
      group: seatCheck.group,
      dividends: seatCheck.group.auctions,
      schedule,
      saved: dues,
      seatRouteId: seatCheck.routeId,
    })

    const remaining = records.reduce((s, r) => s + Math.max(0, r.amountDue - r.amount), 0)
    if (input.amount > remaining) {
      throw new CollectError(
        remaining === 0
          ? "Every instalment of this chit is already paid."
          : `More than the ₹${remaining.toLocaleString("en-IN")} left on the whole chit.`,
        "amount"
      )
    }

    let left = input.amount
    const applied: { installmentNo: number; amount: number }[] = []
    for (const r of records) {
      if (left <= 0) break
      const need = r.amountDue - r.amount
      if (need <= 0) continue
      const pay = Math.min(need, left)
      left -= pay
      applied.push({ installmentNo: r.installmentNo, amount: pay })

      const collected = { amountPaid: r.amount + pay, paidOn: atNoon(today), routeId: route.id }
      await tx.ticketDue.upsert({
        where: {
          ticketId_installmentNo: { ticketId: input.ticketId, installmentNo: r.installmentNo },
        },
        create: {
          ticketId: input.ticketId,
          installmentNo: r.installmentNo,
          dueDate: atNoon(r.dueDate),
          amountDue: r.amountDue,
          intervalId: r.scheduledDue !== null ? (schedule?.id ?? null) : null,
          ...collected,
        },
        update: collected,
      })
    }

    const a = seatCheck.applicant!
    const row = await tx.collection.create({
      data: {
        receiptNo: `TEMP-${crypto.randomUUID()}`,
        ticketId: input.ticketId,
        routeId: route.id,
        customerName: `${a.firstName} ${a.lastName}`.trim(),
        group: seatCheck.group.group,
        installment: applied[0].installmentNo,
        amount: input.amount,
        penalty: 0,
        mode: input.mode,
        reference: input.reference || null,
        note: input.note || null,
        date: isoToDisplay(today),
        collectedBy: user.name,
        status: "paid",
      },
      select: { id: true },
    })

    // Sequential per year and derived from the row id, so two phones
    // collecting at once cannot collide.
    await tx.collection.update({
      where: { id: row.id },
      data: { receiptNo: `RCP-${today.slice(0, 4)}-${String(row.id).padStart(4, "0")}` },
    })

    return { id: row.id, applied }
  })
}

// ---------------------------------------------------------------------------
// Day figures
// ---------------------------------------------------------------------------

/** The route's paid receipts for one yyyy-mm-dd day, oldest first. */
export async function receiptsOn(routeId: number, day: string) {
  const rows = await prisma.collection.findMany({
    where: { routeId, date: isoToDisplay(day), status: "paid" },
    select: RECEIPT_ROW_SELECT,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })
  return rows.map(receiptRow)
}

export function totalsOf(rows: { amount: number; mode: string }[]) {
  const t = { total: 0, cash: 0, online: 0, cheque: 0, receipts: rows.length }
  for (const r of rows) {
    t.total += r.amount
    if (r.mode === "cash" || r.mode === "online" || r.mode === "cheque") t[r.mode] += r.amount
  }
  return t
}

export { istDay, todayIst }
