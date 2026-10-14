import { NextResponse } from "next/server"

import { authorizeApi } from "@/lib/auth-server"
import { parseInterval } from "@/lib/chit-interval"
import { getInterval, listSchemes, saveInterval } from "@/lib/chit-interval-server"

/** Scheme schedules are company-wide configuration, like Settings. */
const SUPER_ONLY = ["SUPER_ADMIN"] as const

/**
 * GET /api/chit-intervals?scheme=5L-25&months=20
 *
 * The saved schedule for that scheme and duration, or a fresh draft built
 * from the scheme's groups. Without `scheme`, lists the schemes.
 */
export async function GET(request: Request) {
  const auth = await authorizeApi(SUPER_ONLY)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const scheme = url.searchParams.get("scheme")?.trim()
  if (!scheme) return NextResponse.json(await listSchemes())

  const months = Number(url.searchParams.get("months"))
  const config = await getInterval(
    scheme,
    Number.isInteger(months) && months > 0 ? months : undefined
  )
  if (!config) return NextResponse.json({ error: "No groups use that scheme." }, { status: 404 })

  return NextResponse.json(config)
}

/** PUT /api/chit-intervals — create or update the schedule for (scheme, months). */
export async function PUT(request: Request) {
  const auth = await authorizeApi(SUPER_ONLY)
  if (!auth.ok) return auth.response

  const parsed = parseInterval(await request.json().catch(() => null))
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Check the highlighted fields.", errors: parsed.errors },
      { status: 400 }
    )
  }

  await saveInterval(parsed.data, auth.user.id)

  return NextResponse.json(await getInterval(parsed.data.scheme, parsed.data.months))
}
