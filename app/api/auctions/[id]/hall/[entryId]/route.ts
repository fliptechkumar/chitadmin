import { fail, failWith, requireAuction, respondWithDetail } from "@/lib/auction-api"
import { leaveHall } from "@/lib/auction-hall"

type Context = { params: Promise<{ id: string; entryId: string }> }

/**
 * DELETE /api/auctions/{id}/hall/{entryId}
 *
 * Takes a member back off this month's auction.
 */
export async function DELETE(_request: Request, { params }: Context) {
  const { id, entryId } = await params

  const access = await requireAuction(id)
  if (!access.ok) return access.response

  const entry = Number(entryId)
  if (!Number.isInteger(entry)) return fail("Invalid hall entry", 400)

  const problem = await leaveHall(access.detail.id, entry)
  if (problem) return failWith(problem)

  return respondWithDetail(access.detail.id)
}
