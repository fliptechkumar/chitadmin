import ChitIntervalEditor from "@/components/admin/chit-interval-editor"
import { requireRole } from "@/lib/auth-server"
import { listSchemes } from "@/lib/chit-interval-server"

export const metadata = { title: "Chit interval" }

export const dynamic = "force-dynamic"

export default async function ChitIntervalPage() {
  await requireRole(["SUPER_ADMIN"])
  return <ChitIntervalEditor schemes={await listSchemes()} />
}
