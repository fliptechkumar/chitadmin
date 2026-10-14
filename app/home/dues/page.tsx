import DuesTable from "@/components/admin/dues-table"
import { requireRole } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { branchScope } from "@/lib/rbac"

export const metadata = { title: "Customer dues" }

export const dynamic = "force-dynamic"

export default async function DuesPage() {
  const user = await requireRole(["SUPER_ADMIN", "CHIT_ADMIN"])

  // Filter options are scoped the same way the rows are, so a Chit Admin is
  // never offered a branch or group they cannot see behind it.
  const groups = await prisma.chitGroup.findMany({
    where: branchScope(user, "branchName"),
    select: { id: true, group: true, branchName: true },
    orderBy: [{ branchName: "asc" }, { group: "asc" }],
  })

  const branches = [...new Set(groups.map((g) => g.branchName))]

  return (
    <div className="space-y-5">
      <div className="reveal" style={{ "--i": 0 } as React.CSSProperties}>
        <h2 className="text-lg font-semibold tracking-tight">Customer dues</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          What each member owes this instalment, and how far behind they are.
        </p>
      </div>

      <DuesTable branches={branches} groups={groups} />
    </div>
  )
}
