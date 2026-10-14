import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { authorizeApi, denyOutsideBranch } from "@/lib/auth-server"
import { branchScope } from "@/lib/rbac"
import { APPLICANT_LIST_SELECT, draftToCreateData } from "@/lib/applicant-mapper"
import { emptyApplicant, validateAll, type ApplicantDraft } from "@/lib/applicant-schema"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

export async function GET() {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const applicants = await prisma.applicant.findMany({
    where: branchScope(auth.user, "branch"),
    select: APPLICANT_LIST_SELECT,
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(applicants)
}

export async function POST(request: Request) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => null)) as Partial<ApplicantDraft> | null

  // Merge onto a blank draft so a missing key is an empty field rather than
  // undefined, which the validators are not written to handle.
  const draft: ApplicantDraft = { ...emptyApplicant(), ...(body ?? {}) }

  const errors = validateAll(draft)
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 })
  }

  const denied = denyOutsideBranch(auth.user, draft.branch.trim())
  if (denied) return denied

  // The reference code embeds the row id, so it is assigned in a transaction
  // right after the insert rather than guessed from a count beforehand.
  const applicant = await prisma.$transaction(async (tx) => {
    const created = await tx.applicant.create({
      data: draftToCreateData(draft, `TEMP-${crypto.randomUUID()}`),
      select: { id: true, createdAt: true },
    })

    return tx.applicant.update({
      where: { id: created.id },
      data: {
        applicantCode: `APP-${created.createdAt.getFullYear()}-${String(created.id).padStart(4, "0")}`,
      },
      select: APPLICANT_LIST_SELECT,
    })
  })

  return NextResponse.json(applicant, { status: 201 })
}
