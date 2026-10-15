import { Prisma } from "@/lib/generated/prisma"

import { prisma } from "@/lib/prisma"
import { authenticateBearer } from "@/lib/api/auth"
import { apiPage, withApiErrors } from "@/lib/api/response"
import { pageMeta, pageParams, searchTerm } from "@/lib/api/pagination"
import { allowedGroupNames } from "@/lib/api/collection-scope"

/** Route logins collect on their own branch, like a Chit Admin. */
const COLLECTOR_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN", "ROUTE"] as const

/**
 * GET /api/v1/customers
 *
 * Lookup for the collection screen: search by name or phone, paginated, and
 * limited to customers who belong to a group in the caller's branches.
 * Includes the dues fields so the agent sees what is owed before collecting.
 */
export async function GET(request: Request) {
  return withApiErrors(async () => {
    const auth = await authenticateBearer(request, COLLECTOR_ROLES)
    if (!auth.ok) return auth.response

    const params = pageParams(request)
    const q = searchTerm(request)
    const groups = await allowedGroupNames(auth.user)

    const where: Prisma.CustomerWhereInput = {
      status: "active",
      // Customer.groups is a string array of group names, so scope is an overlap.
      ...(groups === null ? {} : { groups: { hasSome: groups } }),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    }

    const [rows, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          groups: true,
          pendingDue: true,
          totalPaid: true,
        },
        orderBy: { name: "asc" },
        skip: params.skip,
        take: params.take,
      }),
      prisma.customer.count({ where }),
    ])

    return apiPage(rows, pageMeta(params, total))
  })
}
