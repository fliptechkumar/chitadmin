import CollectionRecords from "@/components/admin/collection-records"
import { requireRole } from "@/lib/auth-server"
import { todayIst } from "@/lib/collection-records-server"
import { prisma } from "@/lib/prisma"
import { branchScope } from "@/lib/rbac"

export const metadata = { title: "Collection records" }

export const dynamic = "force-dynamic"

export default async function CollectionRecordsPage() {
  const user = await requireRole(["SUPER_ADMIN", "CHIT_ADMIN"])

  // Both pickers are scoped like the data behind them, so a Chit Admin is
  // never offered a group or route outside their branches.
  const [groups, routes] = await Promise.all([
    prisma.chitGroup.findMany({
      where: branchScope(user, "branchName"),
      select: { id: true, group: true, branchName: true, amount: true, totalTickets: true, members: true },
      orderBy: [{ branchName: "asc" }, { group: "asc" }],
    }),
    prisma.route.findMany({
      where: { ...branchScope(user, "branch"), isActive: true },
      select: { id: true, code: true, name: true, branch: true },
      orderBy: [{ branch: "asc" }, { code: "asc" }],
    }),
  ])

  return <CollectionRecords groups={groups} routes={routes} today={todayIst()} />
}
