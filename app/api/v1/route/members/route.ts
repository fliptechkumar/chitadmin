import { authenticateRoute, routeMembers } from "@/lib/api/route-app"
import { apiOk, withApiErrors } from "@/lib/api/response"

/**
 * GET /api/v1/route/members
 *
 * Every seated member on the caller's route with where they stand today. A
 * route holds a few hundred seats at most, so the app takes the whole list
 * and searches and filters it on the phone.
 */
export async function GET(request: Request) {
  return withApiErrors(async () => {
    const auth = await authenticateRoute(request)
    if (!auth.ok) return auth.response

    return apiOk(await routeMembers(auth.route.id))
  })
}
