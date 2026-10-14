import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import { authorizeApi } from "@/lib/auth-server"
import { getCompany, saveCompany } from "@/lib/company"
import { parseCompanyInput } from "@/lib/company-schema"

/** Company settings are Super-Admin-only; see ROUTE_RULES in lib/rbac.ts. */
const SUPER_ONLY = ["SUPER_ADMIN"] as const

export async function GET() {
  const auth = await authorizeApi(SUPER_ONLY)
  if (!auth.ok) return auth.response

  return NextResponse.json(await getCompany())
}

export async function PUT(request: Request) {
  const auth = await authorizeApi(SUPER_ONLY)
  if (!auth.ok) return auth.response

  const parsed = parseCompanyInput(await request.json().catch(() => null))
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 })
  }

  const company = await saveCompany(parsed.data)

  // Branding is rendered by server components across the app, so their cached
  // output has to be dropped or the sidebar keeps the old name until reload.
  revalidatePath("/", "layout")

  return NextResponse.json(company)
}
