import { authenticateRoute, routeReceipt } from "@/lib/api/route-app"
import { apiError, apiOk, withApiErrors } from "@/lib/api/response"

type Context = { params: Promise<{ id: string }> }

/** GET /api/v1/route/collections/{id} — one receipt written on this route. */
export async function GET(request: Request, { params }: Context) {
  return withApiErrors(async () => {
    const auth = await authenticateRoute(request)
    if (!auth.ok) return auth.response

    const id = Number((await params).id)
    if (!Number.isInteger(id)) return apiError("VALIDATION_FAILED", "Invalid receipt.")

    const receipt = await routeReceipt(auth.route.id, id)
    if (!receipt) return apiError("NOT_FOUND", "Receipt not found on your route.")

    return apiOk(receipt)
  })
}
