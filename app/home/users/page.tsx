import UsersTable from "@/components/admin/users-table"
import { requireRole } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { assignableRoles, userListScope } from "@/lib/rbac"

export const metadata = { title: "Users" }

// Accounts change through this screen, so never serve a cached list.
export const dynamic = "force-dynamic"

export default async function UsersPage() {
  const user = await requireRole(["SUPER_ADMIN", "CHIT_ADMIN"])

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

  return (
    <div className="space-y-5">
      <div className="reveal" style={{ "--i": 0 } as React.CSSProperties}>
        <h2 className="text-lg font-semibold tracking-tight">Users &amp; access</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {user.role === "SUPER_ADMIN"
            ? "Every account in the portal, with its role and branch access."
            : `Accounts you manage across ${user.branches.join(", ") || "your branches"}.`}
        </p>
      </div>

      <UsersTable
        initialUsers={users.map((row) => ({
          ...row,
          lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
        }))}
        allowedRoles={assignableRoles(user)}
        branchOptions={branchOptions}
        currentUserId={user.id}
      />
    </div>
  )
}
