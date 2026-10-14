import AdvancePreparationReport from "@/components/admin/advance-preparation-report"
import { requireRole } from "@/lib/auth-server"
import { getCompany } from "@/lib/company"
import { prisma } from "@/lib/prisma"
import { branchScope } from "@/lib/rbac"

export const metadata = { title: "Route collection sheet" }

export const dynamic = "force-dynamic"

export default async function CollectionSheetPage() {
  const user = await requireRole(["SUPER_ADMIN", "CHIT_ADMIN"])

  const [groups, routes, company] = await Promise.all([
    prisma.chitGroup.findMany({
      where: branchScope(user, "branchName"),
      select: { branchName: true },
      distinct: ["branchName"],
      orderBy: { branchName: "asc" },
    }),
    prisma.route.findMany({
      where: { ...branchScope(user, "branch"), isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        branch: true,
        areas: true,
        executives: {
          select: { employee: { select: { name: true } } },
          orderBy: { position: "asc" },
        },
        _count: {
          select: { tickets: { where: { applicantId: { not: null }, isCompany: false } } },
        },
      },
      orderBy: [{ branch: "asc" }, { code: "asc" }],
    }),
    getCompany(),
  ])

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })

  return (
    <AdvancePreparationReport
      branches={groups.map((g) => g.branchName)}
      routes={routes.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        branch: r.branch,
        areas: r.areas,
        executives: r.executives.map((e) => e.employee.name),
        subscribers: r._count.tickets,
      }))}
      today={today}
      company={{ name: company.name, shortName: company.shortName }}
    />
  )
}
