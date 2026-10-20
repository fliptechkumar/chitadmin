import { prisma } from "@/lib/prisma"
import { authenticateRoute, routeMembers } from "@/lib/api/route-app"
import { apiError, apiOk, withApiErrors } from "@/lib/api/response"

type Context = { params: Promise<{ id: string }> }

/**
 * GET /api/v1/route/groups/{id}
 *
 * A group seen from the route: its terms, recent auctions and the members on
 * this route. Groups with nobody on the route read as not found.
 */
export async function GET(request: Request, { params }: Context) {
  return withApiErrors(async () => {
    const auth = await authenticateRoute(request)
    if (!auth.ok) return auth.response

    const id = Number((await params).id)
    if (!Number.isInteger(id)) return apiError("VALIDATION_FAILED", "Invalid group.")

    const members = (await routeMembers(auth.route.id)).filter((m) => m.groupId === id)
    if (!members.length) return apiError("NOT_FOUND", "No members of this group on your route.")

    const g = await prisma.chitGroup.findUnique({
      where: { id },
      select: {
        id: true,
        group: true,
        amount: true,
        totalTickets: true,
        members: true,
        startDate: true,
        endDate: true,
        status: true,
        auctions: {
          select: {
            installmentNo: true,
            auctionDate: true,
            prizeAmount: true,
            discount: true,
            dividend: true,
            status: true,
          },
          orderBy: { installmentNo: "desc" },
        },
      },
    })
    if (!g) return apiError("NOT_FOUND", "Group not found.")

    const months = Math.max(1, g.totalTickets)
    const held = g.auctions.filter((a) => a.status === "completed")
    const next = [...g.auctions]
      .reverse()
      .find((a) => a.status === "scheduled" && a.auctionDate >= new Date())

    return apiOk({
      id: g.id,
      code: g.group,
      value: g.amount,
      months,
      seats: g.members,
      status: g.status,
      startDate: g.startDate,
      endDate: g.endDate,
      currentMonth: Math.min(Math.max(...members.map((m) => m.currentInstallment)), months),
      monthlyDue: members[0].monthlyDue,
      nextAuction: next
        ? { installmentNo: next.installmentNo, date: next.auctionDate.toISOString() }
        : null,
      auctions: held.slice(0, 6).map((a) => ({
        installmentNo: a.installmentNo,
        date: a.auctionDate.toISOString(),
        prize: a.prizeAmount,
        discount: a.discount,
        dividend: a.dividend,
      })),
      members,
    })
  })
}
