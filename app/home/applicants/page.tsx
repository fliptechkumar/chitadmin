import ApplicantsTable from "@/components/admin/applicants-table"
import { requireRole } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { APPLICANT_LIST_SELECT } from "@/lib/applicant-mapper"
import { branchScope } from "@/lib/rbac"
import { todayDisplay } from "@/lib/format"

export const metadata = { title: "Applicants" }

export const dynamic = "force-dynamic"

export default async function ApplicantsPage() {
  const user = await requireRole(["SUPER_ADMIN", "CHIT_ADMIN"])
  const scope = branchScope(user, "branch")

  const [applicants, employees, branchRows] = await Promise.all([
    prisma.applicant.findMany({
      where: scope,
      select: APPLICANT_LIST_SELECT,
      orderBy: { createdAt: "desc" },
    }),
    // Only staff the caller could legitimately assign work to.
    prisma.employee.findMany({
      where: { ...branchScope(user, "branch"), status: "active" },
      select: { id: true, name: true, branch: true },
      orderBy: { name: "asc" },
    }),
    prisma.applicant.findMany({
      where: scope,
      distinct: ["branch"],
      select: { branch: true },
      orderBy: { branch: "asc" },
    }),
  ])

  return (
    <div className="space-y-5">
      <div className="reveal" style={{ "--i": 0 } as React.CSSProperties}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Applicant list</h2>
          <span className="tnum text-xs text-muted-foreground">{todayDisplay()}</span>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {user.role === "SUPER_ADMIN"
            ? "Everyone working through enrolment, across all branches."
            : `Enrolments for ${user.branches.join(", ") || "your branches"}.`}
        </p>
      </div>

      <ApplicantsTable
        initialApplicants={applicants.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
        }))}
        employees={employees}
        branches={branchRows.map((row) => row.branch)}
        canSeeBranchColumn={user.role === "SUPER_ADMIN"}
      />
    </div>
  )
}
