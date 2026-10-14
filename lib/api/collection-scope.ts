import "server-only"

import { prisma } from "@/lib/prisma"
import type { Principal } from "@/lib/rbac"

/**
 * Collections have no branch column of their own — they carry a group *name*,
 * and the branch lives on ChitGroup. So scoping means resolving which group
 * names the caller's branches cover, then filtering on those.
 *
 * Returns null for a Super Admin, meaning "no filter".
 */
export async function allowedGroupNames(
  principal: Principal
): Promise<string[] | null> {
  if (principal.role === "SUPER_ADMIN") return null

  const groups = await prisma.chitGroup.findMany({
    where: { branchName: { in: principal.branches } },
    select: { group: true },
  })

  return [...new Set(groups.map((g) => g.group))]
}

/** A Prisma `where` fragment limiting collections to the caller's scope. */
export async function collectionScope(
  principal: Principal
): Promise<Record<string, unknown>> {
  const groups = await allowedGroupNames(principal)
  return groups === null ? {} : { group: { in: groups } }
}

/** The branch a group belongs to, or null when the group does not exist. */
export async function branchForGroup(group: string): Promise<string | null> {
  const row = await prisma.chitGroup.findFirst({
    where: { group },
    select: { branchName: true },
  })
  return row?.branchName ?? null
}
