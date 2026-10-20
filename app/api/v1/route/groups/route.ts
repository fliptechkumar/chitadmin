import { prisma } from "@/lib/prisma"
import { authenticateRoute, routeMembers, todayIst } from "@/lib/api/route-app"
import { apiOk, withApiErrors } from "@/lib/api/response"

/**
 * GET /api/v1/route/groups
 *
 * The chit groups that have members on the caller's route, with how many of
 * those members are paid up for the current month.
 */
export async function GET(request: Request) {
  return withApiErrors(async () => {
    const auth = await authenticateRoute(request)
    if (!auth.ok) return auth.response

    const members = await routeMembers(auth.route.id)
    const byGroup = new Map<number, typeof members>()
    for (const m of members) {
      const list = byGroup.get(m.groupId) ?? []
      list.push(m)
      byGroup.set(m.groupId, list)
    }

    const groups = await prisma.chitGroup.findMany({
      where: { id: { in: [...byGroup.keys()] } },
      select: {
        id: true,
        group: true,
        amount: true,
        totalTickets: true,
        members: true,
        startDate: true,
        status: true,
        auctions: {
          where: { status: "scheduled", auctionDate: { gte: new Date(`${todayIst()}T00:00:00Z`) } },
          select: { installmentNo: true, auctionDate: true },
          orderBy: { auctionDate: "asc" },
          take: 1,
        },
      },
      orderBy: { group: "asc" },
    })

    return apiOk(
      groups.map((g) => {
        const onRoute = byGroup.get(g.id) ?? []
        const months = Math.max(1, g.totalTickets)
        const current = Math.max(...onRoute.map((m) => m.currentInstallment), 1)
        const next = g.auctions[0]
        return {
          id: g.id,
          code: g.group,
          value: g.amount,
          months,
          seats: g.members,
          status: g.status,
          startDate: g.startDate,
          currentMonth: Math.min(current, months),
          membersOnRoute: onRoute.length,
          paidOnRoute: onRoute.filter((m) => m.status === "paid").length,
          monthlyDue: onRoute[0]?.monthlyDue ?? 0,
          nextAuction: next
            ? { installmentNo: next.installmentNo, date: next.auctionDate.toISOString() }
            : null,
        }
      })
    )
  })
}
