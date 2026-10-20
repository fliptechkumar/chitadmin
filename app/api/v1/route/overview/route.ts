import { prisma } from "@/lib/prisma"
import { getCompany } from "@/lib/company"
import {
  authenticateRoute,
  receiptsOn,
  routeMembers,
  todayIst,
  totalsOf,
} from "@/lib/api/route-app"
import { apiOk, withApiErrors } from "@/lib/api/response"
import { scopeKeyFor } from "@/lib/denomination"

/**
 * GET /api/v1/route/overview
 *
 * Everything the app's home screen shows, in one call: today's collection
 * against what is due on the route, member counts by status, arrears, the
 * latest receipts and whether today's cash has been counted.
 */
export async function GET(request: Request) {
  return withApiErrors(async () => {
    const auth = await authenticateRoute(request)
    if (!auth.ok) return auth.response

    const { route } = auth
    const today = todayIst()

    const [company, members, rows, tally] = await Promise.all([
      getCompany(),
      routeMembers(route.id),
      receiptsOn(route.id, today),
      prisma.cashDenomination.findUnique({
        where: {
          date_scopeKey: {
            date: new Date(`${today}T00:00:00Z`),
            scopeKey: scopeKeyFor(route.branch, route.id),
          },
        },
        select: { total: true },
      }),
    ])

    const totals = totalsOf(rows)
    const outstanding = members.reduce((s, m) => s + m.outstanding, 0)
    const thisMonth = members.reduce((s, m) => s + m.currentDue, 0)
    const overdue = members.filter((m) => m.status === "overdue")

    return apiOk({
      date: today,
      route,
      collector: auth.user.name,
      company: { name: company.name, shortName: company.shortName, phone: company.phone },
      today: {
        ...totals,
        // This month's instalments still owed, plus what came in today.
        // Older arrears are reported separately so they do not swamp it.
        target: totals.total + thisMonth,
      },
      counts: {
        members: members.length,
        paid: members.filter((m) => m.status === "paid").length,
        due: members.filter((m) => m.status === "due").length,
        overdue: overdue.length,
        prized: members.filter((m) => m.isPrized).length,
      },
      arrears: {
        amount: overdue.reduce((s, m) => s + m.outstanding, 0),
        accounts: overdue.length,
      },
      outstanding,
      recent: rows.slice(-5).reverse(),
      denomination: { counted: Boolean(tally), total: tally?.total ?? 0, cash: totals.cash },
    })
  })
}
