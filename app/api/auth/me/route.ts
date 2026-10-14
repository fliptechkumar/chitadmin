import { NextResponse } from "next/server"

import { authorizeApi } from "@/lib/auth-server"

/** The current user, for client components that need it outside a server render. */
export async function GET() {
  const auth = await authorizeApi()
  if (!auth.ok) return auth.response

  const { id, username, name, email, role, branches } = auth.user
  return NextResponse.json({ id, username, name, email, role, branches })
}
