import "server-only"

import { NextResponse } from "next/server"

import { authorizeApi, denyOutsideBranch } from "./auth-server"
import { auctionDetailFor, type AuctionDetail, type AuctionProblem } from "./auction-hall"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

export type AuctionAccess =
  | { ok: true; detail: AuctionDetail }
  | { ok: false; response: NextResponse }

/**
 * The gate every /api/auctions/{id} handler opens with: an admin session, a
 * real round, and one the caller's branch scope covers. Written once so the
 * hall routes cannot each grow their own reading of the rules.
 */
export async function requireAuction(id: unknown): Promise<AuctionAccess> {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return { ok: false, response: auth.response }

  const auctionId = Number(id)
  if (!Number.isInteger(auctionId)) {
    return { ok: false, response: fail("Invalid auction id", 400) }
  }

  const detail = await auctionDetailFor(auctionId)
  if (!detail) return { ok: false, response: fail("Auction not found", 404) }

  const denied = denyOutsideBranch(auth.user, detail.branch)
  if (denied) return { ok: false, response: denied }

  return { ok: true, detail }
}

/** The error shape the client reads: `{ errors: { form: "…" } }`. */
export function fail(message: string, status: number): NextResponse {
  return NextResponse.json({ errors: { form: message } }, { status })
}

export function failWith(problem: AuctionProblem): NextResponse {
  return fail(problem.message, problem.status)
}

/** Mutations answer with the whole round, so the page re-renders from one body. */
export async function respondWithDetail(id: number): Promise<NextResponse> {
  const detail = await auctionDetailFor(id)
  if (!detail) return fail("Auction not found", 404)
  return NextResponse.json(detail)
}
