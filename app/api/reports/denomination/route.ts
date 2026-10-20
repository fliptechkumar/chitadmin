import { NextResponse } from "next/server"

import { authorizeApi } from "@/lib/auth-server"
import { buildDenominationReport } from "@/lib/denomination-report"
import { isIsoDay } from "@/lib/denomination"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

/**
 * GET /api/reports/denomination?date=yyyy-mm-dd&branch=&route=
 *
 * One day's paid receipts, rolled up per route with the cash counted against
 * each. `route` is a route id or "unassigned".
 *
 * Read-only: the counts are written by each route from the mobile app
 * (PUT /api/v1/route/denomination), never from the admin site.
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
