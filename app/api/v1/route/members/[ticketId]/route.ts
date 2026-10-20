import { authenticateRoute, routeMemberDetail } from "@/lib/api/route-app"
import { apiError, apiOk, withApiErrors } from "@/lib/api/response"

type Context = { params: Promise<{ ticketId: string }> }

/**
 * GET /api/v1/route/members/{ticketId}
 *
 * One member's seat: profile, the month-by-month ledger and recent receipts.
 * Seats on other routes read as not found.
 */
export async function GET(request: Request, { params }: Context) {
  return withApiErrors(async () => {
    const auth = await authenticateRoute(request)
    if (!auth.ok) return auth.response

    const ticketId = Number((await params).ticketId)
    if (!Number.isInteger(ticketId)) return apiError("VALIDATION_FAILED", "Invalid member.")

    const detail = await routeMemberDetail(auth.route.id, ticketId)
    if (!detail) return apiError("NOT_FOUND", "This member is not on your route.")

    return apiOk(detail)
  })
}
