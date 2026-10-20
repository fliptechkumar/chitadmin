import { prisma } from "@/lib/prisma"
import {
  RECEIPT_ROW_SELECT,
  authenticateRoute,
  receiptRow,
  todayIst,
  totalsOf,
} from "@/lib/api/route-app"
import { apiOk, withApiErrors } from "@/lib/api/response"
import { isoToDisplay, shiftIsoDay } from "@/lib/denomination"

const PERIODS = ["today", "week", "month"] as const
type Period = (typeof PERIODS)[number]

/** yyyy-mm-dd days from `from` to `to`, inclusive. */
function daysBetween(from: string, to: string) {
  const out: string[] = []
  for (let d = from; d <= to; d = shiftIsoDay(d, 1)) out.push(d)
  return out
}

/**
 * GET /api/v1/route/report?period=today|week|month
 *
 * The route's collection for the period, split by mode and by group, plus
 * the last seven days for the bar chart. Receipts store their day as
 * dd/MM/yyyy text, so the period is matched as a list of days.
 */
export async function GET(request: Request) {
  return withApiErrors(async () => {
    const auth = await authenticateRoute(request)
    if (!auth.ok) return auth.response

    const raw = new URL(request.url).searchParams.get("period")
    const period: Period = PERIODS.includes(raw as Period) ? (raw as Period) : "today"

    const today = todayIst()
    const from =
      period === "today" ? today : period === "week" ? shiftIsoDay(today, -6) : `${today.slice(0, 8)}01`
    const lastWeek = shiftIsoDay(today, -6)
    const days = daysBetween(from < lastWeek ? from : lastWeek, today)

    const rows = (
      await prisma.collection.findMany({
        where: {
          routeId: auth.route.id,
          status: "paid",
          date: { in: days.map(isoToDisplay) },
        },
        select: RECEIPT_ROW_SELECT,
      })
    ).map(receiptRow)

    const inPeriod = rows.filter((r) => {
      const [d, m, y] = r.date.split("/")
      return `${y}-${m}-${d}` >= from
    })

    const byGroup = new Map<string, { amount: number; receipts: number }>()
    for (const r of inPeriod) {
      const g = byGroup.get(r.group) ?? { amount: 0, receipts: 0 }
      g.amount += r.amount
      g.receipts += 1
      byGroup.set(r.group, g)
    }

    return apiOk({
      period,
      from,
      to: today,
      totals: totalsOf(inPeriod),
      lastSevenDays: daysBetween(lastWeek, today).map((day) => ({
        date: day,
        amount: rows.filter((r) => r.date === isoToDisplay(day)).reduce((s, r) => s + r.amount, 0),
      })),
      groups: [...byGroup.entries()]
        .map(([group, v]) => ({ group, ...v }))
        .sort((a, b) => b.amount - a.amount),
    })
  })
}
