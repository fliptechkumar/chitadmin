import "server-only"

import type { CurrentUser } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { assignableRoles, userListScope } from "@/lib/rbac"

/** Everything the users table needs, scoped to what `user` may see and assign. */
export async function loadUserManagement(user: CurrentUser) {
  const [users, branchRows] = await Promise.all([
    prisma.user.findMany({
      where: userListScope(user),
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        branches: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: [{ role: "asc" }, { username: "asc" }],
    }),
    // Branches are implied by the groups that exist rather than stored in their
    // own table, so the assignable list is derived from them.
    prisma.chitGroup.findMany({
      distinct: ["branchName"],
      select: { branchName: true },
      orderBy: { branchName: "asc" },
    }),
  ])

  const allBranches = branchRows.map((row) => row.branchName)

  // A Chit Admin can only hand out branches they hold themselves.
  const branchOptions =
    user.role === "SUPER_ADMIN"
      ? allBranches
      : allBranches.filter((branch) => user.branches.includes(branch))

  return {
    initialUsers: users.map((row) => ({
      ...row,
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
    allowedRoles: assignableRoles(user),
    branchOptions,
    currentUserId: user.id,
  }
}
