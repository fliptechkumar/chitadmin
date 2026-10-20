import { prisma } from "@/lib/prisma"
import { authenticateRoute, receiptsOn, todayIst, totalsOf } from "@/lib/api/route-app"
import { apiError, apiOk, withApiErrors } from "@/lib/api/response"
import {
  denominationTotal,
  isIsoDay,
  parseCounts,
  scopeKeyFor,
  shiftIsoDay,
  type DenominationCounts,
} from "@/lib/denomination"

/** How far back a route may still count a day's cash. */
const MAX_DAYS_BACK = 7

const keyFor = (route: { id: number; branch: string }, date: string) => ({
  date: new Date(`${date}T00:00:00Z`),
  scopeKey: scopeKeyFor(route.branch, route.id),
})

/**
 * GET /api/v1/route/denomination?date=yyyy-mm-dd
 *
 * The cash the route should be holding for a day (its cash receipts) and the
 * notes counted against it, if any yet.
 */
export async function GET(request: Request) {
  return withApiErrors(async () => {
    const auth = await authenticateRoute(request)
    if (!auth.ok) return auth.response

    const raw = new URL(request.url).searchParams.get("date")
    const date = raw && isIsoDay(raw) ? raw : todayIst()

    const [rows, tally] = await Promise.all([
      receiptsOn(auth.route.id, date),
      prisma.cashDenomination.findUnique({
        where: { date_scopeKey: keyFor(auth.route, date) },
        select: { counts: true, total: true, remarks: true, updatedAt: true },
      }),
    ])

    return apiOk({
      date,
      cash: totalsOf(rows).cash,
      tally: tally
        ? {
            counts: (tally.counts ?? {}) as DenominationCounts,
            total: tally.total,
            remarks: tally.remarks ?? "",
            updatedAt: tally.updatedAt.toISOString(),
          }
        : null,
    })
  })
}

/**
 * PUT /api/v1/route/denomination
 * { date, counts: { "500": 12, ... }, remarks? }
 *
 * The only place a denomination count is written: the admin site shows it but
 * cannot change it. A count that does not match the day's cash must say why.
 */
export async function PUT(request: Request) {
  return withApiErrors(async () => {
    const auth = await authenticateRoute(request)
    if (!auth.ok) return auth.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const today = todayIst()
    const date = typeof body?.date === "string" && isIsoDay(body.date) ? body.date : ""
    const remarks = typeof body?.remarks === "string" ? body.remarks.trim().slice(0, 500) : ""
    const counts = parseCounts(body?.counts)

    if (!date || date > today || date < shiftIsoDay(today, -MAX_DAYS_BACK)) {
      return apiError(
        "VALIDATION_FAILED",
        `Cash can be counted for today or the last ${MAX_DAYS_BACK} days.`,
        { fields: { date: "Pick a recent day" } }
      )
    }
    if (!counts) {
      return apiError("VALIDATION_FAILED", "Counts must be whole numbers of zero or more.", {
        fields: { counts: "Check the counts" },
      })
    }

    const total = denominationTotal(counts)
    const cash = totalsOf(await receiptsOn(auth.route.id, date)).cash
    if (total !== cash && !remarks) {
      return apiError(
        "VALIDATION_FAILED",
        "The count does not match the cash collected. Add a reason before saving.",
        { fields: { remarks: "Say why the cash is short or over" } }
      )
    }

    const key = keyFor(auth.route, date)
    const saved = await prisma.cashDenomination.upsert({
      where: { date_scopeKey: key },
      create: {
        ...key,
        branch: auth.route.branch,
        routeId: auth.route.id,
        counts,
        total,
        remarks: remarks || null,
        countedById: auth.user.id,
      },
      update: { counts, total, remarks: remarks || null, countedById: auth.user.id },
      select: { total: true, updatedAt: true },
    })

    return apiOk({ date, cash, total: saved.total, updatedAt: saved.updatedAt.toISOString() })
  })
}
