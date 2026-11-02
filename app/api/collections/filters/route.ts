import { NextResponse } from "next/server"

import { registerScope } from "@/lib/api/collection-scope"
import { authorizeApi } from "@/lib/auth-server"
import type { RegisterFilters } from "@/lib/collection-register"
import { prisma } from "@/lib/prisma"
import { branchScope } from "@/lib/rbac"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

/**
 * GET /api/collections/filters
 *
 * The filter menus. Groups and collectors come from the receipts themselves,
 * so each choice finds something; every route in scope is offered, so a route
 * that has not collected yet can be seen to have nothing.
 */
export async function GET() {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const scope = await registerScope(auth.user)
  const [routes, groups, collectors] = await Promise.all([
    prisma.route.findMany({
      where: branchScope(auth.user, "branch"),
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
    prisma.collection.findMany({
      where: scope,
      select: { group: true },
      distinct: ["group"],
      orderBy: { group: "asc" },
    }),
    prisma.collection.findMany({
      where: scope,
      select: { collectedBy: true },
      distinct: ["collectedBy"],
      orderBy: { collectedBy: "asc" },
    }),
  ])

  const body: RegisterFilters = {
    routes,
    groups: groups.map((g) => g.group),
    collectors: collectors.map((c) => c.collectedBy),
  }
  return NextResponse.json(body)
}
