import {
  CollectError,
  authenticateRoute,
  parseCollectInput,
  receiptsOn,
  recordRoutePayment,
  routeReceipt,
  todayIst,
  totalsOf,
} from "@/lib/api/route-app"
import { apiError, apiOk, withApiErrors } from "@/lib/api/response"
import { isIsoDay } from "@/lib/denomination"

/**
 * GET /api/v1/route/collections?date=yyyy-mm-dd
 *
 * The route's receipts for a day (today by default) with mode totals — the
 * day statement.
 */
export async function GET(request: Request) {
  return withApiErrors(async () => {
    const auth = await authenticateRoute(request)
    if (!auth.ok) return auth.response

    const raw = new URL(request.url).searchParams.get("date")
    const date = raw && isIsoDay(raw) ? raw : todayIst()

    const rows = await receiptsOn(auth.route.id, date)
    return apiOk({ date, rows, totals: totalsOf(rows) })
  })
}

/**
 * POST /api/v1/route/collections
 * { ticketId, amount, mode: "cash" | "online" | "cheque", reference?, note? }
 *
 * Records a payment against a member on the caller's route and returns the
 * receipt, so the app can show and print it without a second call.
 */
export async function POST(request: Request) {
  return withApiErrors(async () => {
    const auth = await authenticateRoute(request)
    if (!auth.ok) return auth.response

    const parsed = parseCollectInput(await request.json().catch(() => null))
    if (!parsed.ok) {
      return apiError("VALIDATION_FAILED", "Check the highlighted fields.", {
        fields: parsed.fields,
      })
    }

    try {
      const saved = await recordRoutePayment(auth.user, auth.route, parsed.data)
      const receipt = await routeReceipt(auth.route.id, saved.id)
      return apiOk({ receipt, applied: saved.applied }, { status: 201 })
    } catch (error) {
      if (error instanceof CollectError) {
        return apiError("VALIDATION_FAILED", error.message, {
          ...(error.field ? { fields: { [error.field]: error.message } } : {}),
        })
      }
      throw error
    }
  })
}
