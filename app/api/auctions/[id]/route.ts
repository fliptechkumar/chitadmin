import { NextResponse } from "next/server"

import { requireAuction } from "@/lib/auction-api"

type Context = { params: Promise<{ id: string }> }

/**
 * GET /api/auctions/{id}
 *
 * One round in full: its figures, the members sitting in the auction hall with
 * what they have bid, and the field they were drawn from. Fetched by the
 * detail page rather than sent with every list row, since it costs several
 * extra queries per group.
 */
export async function GET(_request: Request, { params }: Context) {
  const access = await requireAuction((await params).id)
  if (!access.ok) return access.response

  return NextResponse.json(access.detail)
}
