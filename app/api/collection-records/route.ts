import { NextResponse } from "next/server"

import { authorizeApi } from "@/lib/auth-server"
import { scopedGroup, seatsForGroup } from "@/lib/collection-records-server"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

/**
 * GET /api/collection-records?groupId=
 *
 * The customers (seated members) of one group, for the customer picker.
 */
export async function GET(request: Request) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const groupId = Number(new URL(request.url).searchParams.get("groupId"))
  if (!Number.isInteger(groupId) || groupId < 1) {
    return NextResponse.json({ error: "Select a group." }, { status: 400 })
  }

  const scoped = await scopedGroup(auth.user, groupId)
  if (!scoped.ok) return NextResponse.json({ error: scoped.error }, { status: scoped.status })

  return NextResponse.json(await seatsForGroup(groupId))
}
