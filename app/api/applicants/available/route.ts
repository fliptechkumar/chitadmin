import { NextResponse } from "next/server"
import type { Prisma } from "@/lib/generated/prisma"

import { prisma } from "@/lib/prisma"
import { authorizeApi } from "@/lib/auth-server"
import { branchScope } from "@/lib/rbac"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

/**
 * Applicants who can take a seat, for the assign dialog.
 *
 * Filtered to one branch (`?branch=`) because a seat belongs to its group's
 * branch. Rejected applicants are excluded, and so are any already holding a
 * seat in the group being filled (`?excludeGroupId=`) — they cannot take two.
 */
export async function GET(request: Request) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const q = url.searchParams.get("q")?.trim()
  const branch = url.searchParams.get("branch")?.trim()
  const excludeGroupId = Number(url.searchParams.get("excludeGroupId"))

  const seated = Number.isInteger(excludeGroupId)
    ? await prisma.chitTicket.findMany({
        where: { groupId: excludeGroupId, applicantId: { not: null } },
        select: { applicantId: true },
      })
    : []

  const takenIds = seated
    .map((t) => t.applicantId)
    .filter((id): id is number => id !== null)

  const where: Prisma.ApplicantWhereInput = {
    ...branchScope(auth.user, "branch"),
    ...(branch ? { branch } : {}),
    status: { not: "rejected" },
    ...(takenIds.length > 0 ? { id: { notIn: takenIds } } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { applicantCode: { contains: q, mode: "insensitive" } },
            { mobile: { contains: q } },
          ],
        }
      : {}),
  }

  const applicants = await prisma.applicant.findMany({
    where,
    select: {
      id: true,
      applicantCode: true,
      firstName: true,
      lastName: true,
      mobile: true,
      area: true,
      chitValue: true,
      status: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return NextResponse.json(
    applicants.map((a) => ({
      id: a.id,
      code: a.applicantCode,
      name: `${a.firstName} ${a.lastName}`.trim(),
      mobile: a.mobile,
      area: a.area,
      chitValue: a.chitValue,
      status: a.status,
    }))
  )
}
