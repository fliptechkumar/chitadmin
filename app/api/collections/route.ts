import { NextResponse } from "next/server"

import type { Prisma } from "@/lib/generated/prisma"

import { prisma } from "@/lib/prisma"
import { authorizeApi } from "@/lib/auth-server"
import { registerScope } from "@/lib/api/collection-scope"
import { pageMeta, pageParams, searchTerm } from "@/lib/api/pagination"
import { todayIst } from "@/lib/collection-records-server"
import type { RegisterPage } from "@/lib/collection-register"
import { COLLECTION_MODES } from "@/lib/collection-schema"
import { isIsoDay, isoToDisplay } from "@/lib/denomination"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

const DAY_MS = 86_400_000

/** Midnight at the start of a yyyy-mm-dd day in India. */
const istStart = (day: string) => new Date(`${day}T00:00:00+05:30`)

/** The allowed value of a query parameter, or undefined for anything else. */
const oneOf = <T extends string>(values: readonly T[], raw: string | null) =>
  values.find((v) => v === raw)

/**
 * GET /api/collections?q=&mode=&route=&group=&collector=&from=&to=&page=&limit=
 *
 * The receipt register, newest first and limited to the caller's branches.
 * Only receipts tied to a seat are listed: those are the ones the route app
 * wrote. Read-only: corrections to what a member has paid are made on
 * Collection Records.
 *
 * `from` and `to` are yyyy-mm-dd on the branches' calendar. They test the time
 * a receipt was written, because `date` is stored as dd/MM/yyyy text and does
 * not sort; the app always writes a receipt on the day it counts towards.
 */
export async function GET(request: Request) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const params = pageParams(request)
  const q = searchTerm(request)
  const mode = oneOf(COLLECTION_MODES, url.searchParams.get("mode"))

  const route = Number(url.searchParams.get("route"))
  const group = url.searchParams.get("group")
  const collector = url.searchParams.get("collector")
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")

  const scope = await registerScope(auth.user)
  const where: Prisma.CollectionWhereInput = {
    ...scope,
    ...(mode ? { mode } : {}),
    ...(Number.isInteger(route) && route > 0 ? { routeId: route } : {}),
    ...(collector ? { collectedBy: collector } : {}),
    ...(isIsoDay(from) || isIsoDay(to)
      ? {
          createdAt: {
            ...(isIsoDay(from) ? { gte: istStart(from) } : {}),
            ...(isIsoDay(to) ? { lt: new Date(istStart(to).getTime() + DAY_MS) } : {}),
          },
        }
      : {}),
    // Together with the scope's own limit on group, never in place of it.
    AND: [
      ...(group ? [{ group }] : []),
      ...(q
        ? [
            {
              OR: [
                { receiptNo: { contains: q, mode: "insensitive" as const } },
                { customerName: { contains: q, mode: "insensitive" as const } },
                { group: { contains: q, mode: "insensitive" as const } },
                { reference: { contains: q, mode: "insensitive" as const } },
                {
                  ticket: {
                    is: {
                      applicant: {
                        is: {
                          OR: [
                            { applicantCode: { contains: q, mode: "insensitive" as const } },
                            { mobile: { contains: q } },
                          ],
                        },
                      },
                    },
                  },
                },
              ],
            },
          ]
        : []),
    ],
  }

  const [rows, total, today, byMode] = await Promise.all([
    prisma.collection.findMany({
      where,
      select: {
        id: true,
        receiptNo: true,
        customerName: true,
        group: true,
        installment: true,
        amount: true,
        mode: true,
        date: true,
        collectedBy: true,
        reference: true,
        route: { select: { code: true } },
      },
      orderBy: { id: "desc" },
      skip: params.skip,
      take: params.take,
    }),
    prisma.collection.count({ where }),
    prisma.collection.aggregate({
      where: { ...scope, date: isoToDisplay(todayIst()) },
      _sum: { amount: true },
    }),
    prisma.collection.groupBy({
      by: ["mode"],
      where,
      _sum: { amount: true },
    }),
  ])

  const body: RegisterPage = {
    rows: rows.map(({ route, ...row }) => ({ ...row, route: route?.code ?? null })),
    total,
    totalPages: pageMeta(params, total).totalPages,
    stats: {
      todayTotal: today._sum.amount ?? 0,
      receiptsTotal: byMode.reduce((sum, m) => sum + (m._sum.amount ?? 0), 0),
      receiptCount: total,
      byMode: Object.fromEntries(byMode.map((m) => [m.mode, m._sum.amount ?? 0])),
    },
  }

  return NextResponse.json(body)
}
