import Link from "next/link"
import { ArrowLeft, UserPlus } from "lucide-react"

import ApplicantForm from "@/components/admin/applicant-form"
import { Button } from "@/components/ui/button"
import { requireRole } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

export const metadata = { title: "Add applicant" }

export const dynamic = "force-dynamic"

export default async function NewApplicantPage() {
  const user = await requireRole(["SUPER_ADMIN", "CHIT_ADMIN"])

  // Branches come from the groups that exist; a Chit Admin only sees their own.
  const branchRows = await prisma.chitGroup.findMany({
    distinct: ["branchName"],
    select: { branchName: true },
    orderBy: { branchName: "asc" },
  })

  const allBranches = branchRows.map((row) => row.branchName)
  const branches =
    user.role === "SUPER_ADMIN"
      ? allBranches
      : allBranches.filter((branch) => user.branches.includes(branch))

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div
        className="reveal flex flex-wrap items-start gap-4"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
          <UserPlus className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">Add applicant</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Capture the details needed to enrol a new subscriber. Fields marked
            with an asterisk are required before you can continue.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/home/applicants">
            <ArrowLeft className="h-4 w-4" />
            Back to list
          </Link>
        </Button>
      </div>

      <ApplicantForm branches={branches} />
    </div>
  )
}
