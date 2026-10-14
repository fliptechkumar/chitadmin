import DenominationReport from "@/components/admin/denomination-report"
import { requireRole } from "@/lib/auth-server"
import { getCompany } from "@/lib/company"
import { prisma } from "@/lib/prisma"
import { branchScope } from "@/lib/rbac"

export const metadata = { title: "Denomination report" }

export const dynamic = "force-dynamic"

export default async function DenominationReportPage() {
  const user = await requireRole(["SUPER_ADMIN", "CHIT_ADMIN"])

  // Filter options are scoped like the rows, so a Chit Admin is never offered
  // a branch or route they cannot see behind it.
  const [groups, routes, company] = await Promise.all([
    prisma.chitGroup.findMany({
      where: branchScope(user, "branchName"),
      select: { branchName: true },
      distinct: ["branchName"],
      orderBy: { branchName: "asc" },
    }),
    prisma.route.findMany({
      where: { ...branchScope(user, "branch"), isActive: true },
      select: { id: true, code: true, name: true, branch: true },
      orderBy: [{ branch: "asc" }, { code: "asc" }],
    }),
    getCompany(),
  ])

  // Collection days follow the branches' local calendar, not the server's.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })

  const address = [company.addressLine, company.city, company.state, company.pincode]
    .filter(Boolean)
    .join(", ")

  return (
    <DenominationReport
      branches={groups.map((g) => g.branchName)}
      routes={routes}
      initialDate={today}
      company={{ name: company.name, address }}
    />
  )
}
