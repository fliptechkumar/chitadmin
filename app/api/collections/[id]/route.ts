import { NextResponse } from "next/server"

import { registerScope } from "@/lib/api/collection-scope"
import { receiptWhere } from "@/lib/api/route-app"
import { authorizeApi } from "@/lib/auth-server"
import type { ReceiptDetail } from "@/lib/collection-register"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

type Context = { params: Promise<{ id: string }> }

/** GET /api/collections/:id — one receipt, within the caller's branches. */
export async function GET(_request: Request, { params }: Context) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const id = Number((await params).id)
  const receipt = Number.isInteger(id)
    ? await receiptWhere({ ...(await registerScope(auth.user)), id })
    : null
  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 })
  }

  const body: ReceiptDetail = receipt
  return NextResponse.json(body)
}
