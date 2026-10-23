import { NextResponse } from "next/server"
import { Prisma, type ApplicantStatus } from "@/lib/generated/prisma"

import { prisma } from "@/lib/prisma"
import { authorizeApi, denyOutsideBranch } from "@/lib/auth-server"
import { APPLICANT_LIST_SELECT, draftToUpdateData } from "@/lib/applicant-mapper"
import { emptyApplicant, validateAll, type ApplicantDraft } from "@/lib/applicant-schema"

type Context = { params: Promise<{ id: string }> }

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

const STATUSES: ApplicantStatus[] = ["pending", "allocated", "approved", "rejected"]

const notFound = () =>
  NextResponse.json({ errors: { id: "Applicant not found" } }, { status: 404 })

/**
 * Partial update for the list actions: change status, assign an employee, or
 * mark documents collected. The full record is edited through the form.
 */
export async function PATCH(request: Request, { params }: Context) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const id = Number((await params).id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ errors: { id: "Invalid applicant id" } }, { status: 400 })
  }

  const existing = await prisma.applicant.findUnique({
    where: { id },
    select: { branch: true },
  })
  if (!existing) return notFound()

  const denied = denyOutsideBranch(auth.user, existing.branch)
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as {
    status?: unknown
    assignedToId?: unknown
    documentsUploaded?: unknown
  } | null

  const data: Prisma.ApplicantUpdateInput = {}

  if (body?.status !== undefined) {
    if (!STATUSES.includes(body.status as ApplicantStatus)) {
      return NextResponse.json({ errors: { status: "Unknown status" } }, { status: 400 })
    }
    data.status = body.status as ApplicantStatus
  }

  if (body?.assignedToId !== undefined) {
    if (body.assignedToId === null) {
      data.assignedTo = { disconnect: true }
    } else {
      const employeeId = Number(body.assignedToId)
      if (!Number.isInteger(employeeId)) {
        return NextResponse.json(
          { errors: { assignedToId: "Invalid employee" } },
          { status: 400 }
        )
      }

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { branch: true },
      })
      if (!employee) {
        return NextResponse.json(
          { errors: { assignedToId: "Employee not found" } },
          { status: 404 }
        )
      }

      // Staff can only be assigned work in a branch the caller holds.
      const deniedAssign = denyOutsideBranch(auth.user, employee.branch)
      if (deniedAssign) return deniedAssign

      data.assignedTo = { connect: { id: employeeId } }
    }
  }

  if (typeof body?.documentsUploaded === "boolean") {
    data.documentsUploaded = body.documentsUploaded
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ errors: { id: "Nothing to update" } }, { status: 400 })
  }

  const applicant = await prisma.applicant.update({
    where: { id },
    data,
    select: APPLICANT_LIST_SELECT,
  })

  return NextResponse.json(applicant)
}

/**
 * Full edit from the applicant form. Uses the lighter "edit" rules: imported
 * members lack most enrolment details, and a correction must not demand them.
 */
export async function PUT(request: Request, { params }: Context) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const id = Number((await params).id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ errors: { id: "Invalid applicant id" } }, { status: 400 })
  }

  const existing = await prisma.applicant.findUnique({
    where: { id },
    select: { branch: true },
  })
  if (!existing) return notFound()

  const denied = denyOutsideBranch(auth.user, existing.branch)
  if (denied) return denied

  const body = (await request.json().catch(() => null)) as Partial<ApplicantDraft> | null
  const draft: ApplicantDraft = { ...emptyApplicant(), ...(body ?? {}) }

  const errors = validateAll(draft, "edit")
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 })
  }

  // Moving an applicant is allowed only into a branch the caller also holds.
  const deniedMove = denyOutsideBranch(auth.user, draft.branch.trim())
  if (deniedMove) return deniedMove

  const applicant = await prisma.applicant.update({
    where: { id },
    data: draftToUpdateData(draft),
    select: APPLICANT_LIST_SELECT,
  })

  return NextResponse.json(applicant)
}

export async function DELETE(_request: Request, { params }: Context) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const id = Number((await params).id)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ errors: { id: "Invalid applicant id" } }, { status: 400 })
  }

  const existing = await prisma.applicant.findUnique({
    where: { id },
    select: { branch: true },
  })
  if (!existing) return notFound()

  const denied = denyOutsideBranch(auth.user, existing.branch)
  if (denied) return denied

  await prisma.applicant.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
