import { requireRole } from "@/lib/auth-server"

/**
 * Settings are Super-Admin-only. The page itself is a client component, so the
 * check lives in this server layout where it cannot be bypassed.
 */
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(["SUPER_ADMIN"])
  return <>{children}</>
}
