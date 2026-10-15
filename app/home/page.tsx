import Dashboard from "@/components/admin/dashboard"
import { requireRole } from "@/lib/auth-server"
import { loadDashboard } from "@/lib/dashboard"

export const metadata = { title: "Dashboard" }

// Figures are read live on every visit.
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const user = await requireRole(["SUPER_ADMIN", "CHIT_ADMIN"])
  return <Dashboard data={await loadDashboard(user)} />
}
