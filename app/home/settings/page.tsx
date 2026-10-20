import UsersTable from "@/components/admin/users-table"
import { requireRole } from "@/lib/auth-server"
import { loadUserManagement } from "@/lib/users-server"

import SettingsView from "./settings-view"

// The user management section lists live accounts, so never serve a cached copy.
export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const user = await requireRole(["SUPER_ADMIN"])
  const data = await loadUserManagement(user)

  return <SettingsView userManagement={<UsersTable {...data} />} />
}
