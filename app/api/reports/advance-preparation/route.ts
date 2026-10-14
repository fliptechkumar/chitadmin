import { NextResponse } from "next/server"

import { authorizeApi } from "@/lib/auth-server"
import { buildAdvanceReport, parseAdvanceQuery } from "@/lib/advance-preparation-report"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

/**
 * GET /api/reports/advance-preparation?from=&to=&branch=&route=
 *
 * Every seated subscriber in scope with what falls due in the period. The
 * lighter filters (prized, collection type, status, search) are applied by the
 * caller, so switching them needs no round trip.
 */
export async function GET(request: Request) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const parsed = parseAdvanceQuery(new URL(request.url))
  if (!parsed.ok) return parsed.response

  return NextResponse.json(await buildAdvanceReport(auth.user, parsed.query))
}
