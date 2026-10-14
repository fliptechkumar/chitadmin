import { NextResponse } from "next/server"

import { endSession, getCurrentUser } from "@/lib/auth-server"

/**
 * Deletes the session row and clears the cookie. Responds 200 even when no
 * session is present so a double-click on "Sign out" is not an error.
 */
export async function POST() {
  const user = await getCurrentUser()
  const response = NextResponse.json({ ok: true })

  if (user) {
    await endSession(response, user.sessionId)
  }

  return response
}
