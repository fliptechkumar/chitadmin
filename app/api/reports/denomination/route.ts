import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { authorizeApi, denyOutsideBranch } from "@/lib/auth-server"
import { buildDenominationReport } from "@/lib/denomination-report"
import {
  denominationTotal,
  isIsoDay,
  parseCounts,
  scopeKeyFor,
} from "@/lib/denomination"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

/**
 * GET /api/reports/denomination?date=yyyy-mm-dd&branch=&route=
 *
 * One day's paid receipts, rolled up per route with the cash counted against
 * each. `route` is a route id or "unassigned".
 */
export async function GET(request: Request) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const date = url.searchParams.get("date")
  if (!isIsoDay(date)) {
    return NextResponse.json({ error: "Pick a collection date." }, { status: 400 })
  }

  const report = await buildDenominationReport(auth.user, {
    date,
    branch: url.searchParams.get("branch")?.trim() || undefined,
    route: url.searchParams.get("route")?.trim() || undefined,
  })

  return NextResponse.json(report)
}

/**
 * PUT /api/reports/denomination
 *
 * Records the notes counted for one route on one day, replacing any earlier
 * count. An all-zero count with no remarks clears it.
 */
export async function PUT(request: Request) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const date = typeof body?.date === "string" ? body.date : ""
  const branch = typeof body?.branch === "string" ? body.branch.trim() : ""
  const routeId =
    body?.routeId === null || body?.routeId === undefined ? null : Number(body.routeId)
  const remarks = typeof body?.remarks === "string" ? body.remarks.trim().slice(0, 500) : ""
  const counts = parseCounts(body?.counts)

  if (!isIsoDay(date)) {
    return NextResponse.json({ error: "Pick a collection date." }, { status: 400 })
  }
  if (!branch) {
    return NextResponse.json({ error: "Branch is required." }, { status: 400 })
  }
  if (routeId !== null && (!Number.isInteger(routeId) || routeId < 1)) {
    return NextResponse.json({ error: "Unknown route." }, { status: 400 })
  }
  if (!counts) {
    return NextResponse.json(
      { error: "Counts must be whole numbers of zero or more." },
      { status: 400 }
    )
  }

  const denied = denyOutsideBranch(auth.user, branch)
  if (denied) return denied

  if (routeId !== null) {
    const route = await prisma.route.findUnique({
      where: { id: routeId },
      select: { branch: true },
    })
    if (!route || route.branch !== branch) {
      return NextResponse.json(
        { error: "That route does not belong to this branch." },
        { status: 400 }
      )
    }
  }

  const key = { date: new Date(`${date}T00:00:00Z`), scopeKey: scopeKeyFor(branch, routeId) }
  const total = denominationTotal(counts)

  if (total === 0 && !remarks) {
    await prisma.cashDenomination.deleteMany({ where: key })
    return NextResponse.json({ cleared: true })
  }

  const saved = await prisma.cashDenomination.upsert({
    where: { date_scopeKey: key },
    create: {
      ...key,
      branch,
      routeId,
      counts,
      total,
      remarks: remarks || null,
      countedById: auth.user.id,
    },
    update: { counts, total, remarks: remarks || null, countedById: auth.user.id },
    select: { total: true, updatedAt: true },
  })

  return NextResponse.json(saved)
}
