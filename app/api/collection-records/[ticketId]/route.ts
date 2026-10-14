import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { authorizeApi } from "@/lib/auth-server"
import { parseRecords } from "@/lib/collection-records"
import {
  loadSeatRecords,
  saveSeatRecords,
  todayIst,
} from "@/lib/collection-records-server"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

type Params = { params: Promise<{ ticketId: string }> }

async function ticketIdOf(params: Params["params"]) {
  const id = Number((await params).ticketId)
  return Number.isInteger(id) && id > 0 ? id : null
}

/** GET /api/collection-records/:ticketId — one row per month of the scheme. */
export async function GET(_request: Request, { params }: Params) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const ticketId = await ticketIdOf(params)
  if (!ticketId) return NextResponse.json({ error: "Unknown customer." }, { status: 400 })

  const result = await loadSeatRecords(auth.user, ticketId)
  if ("ok" in result) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json(result)
}

/**
 * PUT /api/collection-records/:ticketId  { records: RecordInput[], applySchedule? }
 *
 * Saves every month at once and returns the ledger as now stored.
 */
export async function PUT(request: Request, { params }: Params) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const ticketId = await ticketIdOf(params)
  if (!ticketId) return NextResponse.json({ error: "Unknown customer." }, { status: 400 })

  const current = await loadSeatRecords(auth.user, ticketId)
  if ("ok" in current) {
    return NextResponse.json({ error: current.error }, { status: current.status })
  }

  const body = (await request.json().catch(() => null)) as {
    records?: unknown
    applySchedule?: unknown
  } | null
  const parsed = parseRecords(body?.records, current.seat.months, todayIst())
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.message ?? "Check the highlighted months.", errors: parsed.errors },
      { status: 400 }
    )
  }

  // Routes must exist and belong to the group's branch.
  const routeIds = [...new Set(parsed.data.map((r) => r.routeId).filter((id): id is number => id !== null))]
  if (routeIds.length) {
    const routes = await prisma.route.findMany({
      where: { id: { in: routeIds } },
      select: { id: true, branch: true },
    })
    const valid = new Set(
      routes.filter((r) => r.branch === current.seat.branch).map((r) => r.id)
    )
    const errors = Object.fromEntries(
      parsed.data
        .filter((r) => r.routeId !== null && !valid.has(r.routeId))
        .map((r) => [r.installmentNo, { route: `Not a ${current.seat.branch} route` }])
    )
    if (Object.keys(errors).length) {
      return NextResponse.json({ error: "Check the highlighted months.", errors }, { status: 400 })
    }
  }

  await saveSeatRecords(ticketId, current, parsed.data, body?.applySchedule === true)

  const fresh = await loadSeatRecords(auth.user, ticketId)
  return NextResponse.json(fresh)
}
