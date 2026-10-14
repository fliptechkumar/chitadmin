import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { authorizeApi } from "@/lib/auth-server"
import { branchScope } from "@/lib/rbac"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

/**
 * Active staff, branch-scoped. Used by pickers — route executives, applicant
 * assignment — rather than as a full employee management surface.
 */
export async function GET() {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const employees = await prisma.employee.findMany({
    where: { ...branchScope(auth.user, "branch"), status: "active" },
    select: { id: true, name: true, branch: true, role: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(employees)
}
