import { redirect } from "next/navigation"

/** Reports has no landing page of its own; open its first report. */
export default function ReportsPage() {
  redirect("/home/reports/collection-sheet")
}
