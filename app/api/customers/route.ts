import { NextResponse } from "next/server"
import type { Prisma } from "@/lib/generated/prisma"

import { prisma } from "@/lib/prisma"
import { authorizeApi } from "@/lib/auth-server"
import { allowedGroupNames } from "@/lib/api/collection-scope"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

/**
 * Customer lookup for pickers, searchable by name or phone.
 *
 * Customer carries no branch column — only the group names it belongs to — so
 * a Chit Admin sees customers already in one of their groups, plus customers
 * in no group at all (newly enrolled, not yet seated anywhere). Giving Customer
 * a real branch would let this scope as tightly as everything else does.
 */
export async function GET(request: Request) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const q = new URL(request.url).searchParams.get("q")?.trim()
  const groups = await allowedGroupNames(auth.user)

  const where: Prisma.CustomerWhereInput = {
    status: "active",
    ...(groups === null
      ? {}
      : { OR: [{ groups: { hasSome: groups } }, { groups: { isEmpty: true } }] }),
    ...(q
      ? {
          AND: [
            {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
              ],
            },
          ],
        }
      : {}),
  }

  const customers = await prisma.customer.findMany({
    where,
    select: { id: true, name: true, phone: true, groups: true, pendingDue: true },
    orderBy: { name: "asc" },
    take: 50,
  })

  return NextResponse.json(customers)
}
