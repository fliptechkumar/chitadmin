import { fail, failWith, requireAuction, respondWithDetail } from "@/lib/auction-api"
import { seatInHall } from "@/lib/auction-hall"

type Context = { params: Promise<{ id: string }> }

/**
 * POST /api/auctions/{id}/hall
 *
 * Assigns a member of the group to this month's auction. Answers with the
 * whole round, so the page re-renders from one body.
 */
export async function POST(request: Request, { params }: Context) {
  const access = await requireAuction((await params).id)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as { ticketId?: unknown } | null

  const ticketId = Number(body?.ticketId)
  if (!Number.isInteger(ticketId)) return fail("Pick a member to assign.", 400)

  const problem = await seatInHall(access.detail.id, ticketId)
  if (problem) return failWith(problem)

  return respondWithDetail(access.detail.id)
}
