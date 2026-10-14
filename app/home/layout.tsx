import AdminShell from "@/components/admin/admin-shell"
import { requireRole } from "@/lib/auth-server"
import { getCompany } from "@/lib/company"

/**
 * The admin area's server-side gate. Middleware has already rejected anonymous
 * and wrong-role requests on signature alone; this re-checks against the
 * database, so a session revoked since the token was issued cannot render a
 * single admin page.
 */
export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireRole(["SUPER_ADMIN", "CHIT_ADMIN"])
  const company = await getCompany()

  return (
    <AdminShell
      company={company}
      user={{
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        branches: user.branches,
      }}
    >
      {children}
    </AdminShell>
  )
}
