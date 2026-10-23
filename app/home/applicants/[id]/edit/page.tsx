import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, UserPen } from "lucide-react"

import ApplicantForm from "@/components/admin/applicant-form"
import { Button } from "@/components/ui/button"
import { APPLICANT_EDIT_SELECT, applicantToDraft } from "@/lib/applicant-mapper"
import { requireRole } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { canAccessBranch } from "@/lib/rbac"

export const metadata = { title: "Edit applicant" }

export const dynamic = "force-dynamic"

export default async function EditApplicantPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireRole(["SUPER_ADMIN", "CHIT_ADMIN"])

  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()

  const [applicant, branchRows] = await Promise.all([
    prisma.applicant.findUnique({
      where: { id },
      select: { applicantCode: true, ...APPLICANT_EDIT_SELECT },
    }),
    prisma.chitGroup.findMany({
      distinct: ["branchName"],
      select: { branchName: true },
      orderBy: { branchName: "asc" },
    }),
  ])

  // Another branch's applicant is reported as missing rather than forbidden,
  // so a Chit Admin cannot probe which ids exist elsewhere.
  if (!applicant || !canAccessBranch(user, applicant.branch)) notFound()

  // Same branch list as the add form, plus the applicant's own branch in case
  // it no longer has any groups.
  const allBranches = [...new Set([...branchRows.map((row) => row.branchName), applicant.branch])].sort()
  const branches =
    user.role === "SUPER_ADMIN"
      ? allBranches
      : allBranches.filter((branch) => user.branches.includes(branch))

  const name = `${applicant.firstName} ${applicant.lastName}`.trim()

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div
        className="reveal flex flex-wrap items-start gap-4"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
          <UserPen className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">Edit applicant</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {name} · <span className="tnum">{applicant.applicantCode}</span>. Change any
            step and save. Only branch, first name and mobile are required here;
            anything you fill in is still checked.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/home/applicants">
            <ArrowLeft className="h-4 w-4" />
            Back to list
          </Link>
        </Button>
      </div>

      <ApplicantForm
        branches={branches}
        applicant={{ id, code: applicant.applicantCode, draft: applicantToDraft(applicant) }}
      />
    </div>
  )
}
