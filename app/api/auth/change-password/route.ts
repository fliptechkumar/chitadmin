import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser, revokeOtherSessions } from "@/lib/auth-server"
import { hashPassword, verifyPassword } from "@/lib/password"
import { validatePassword } from "@/lib/password-rules"

/**
 * POST /api/auth/change-password
 *
 * A user changing their own password. The current one is required even though
 * the caller is already authenticated — otherwise a hijacked session could
 * lock the real owner out without ever knowing their password.
 *
 * Works for every role: this is self-service, not the admin reset that lives on
 * PATCH /api/users/{id}.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { errors: { form: "Authentication required." } },
      { status: 401 }
    )
  }

  const body = (await request.json().catch(() => null)) as {
    currentPassword?: unknown
    newPassword?: unknown
    confirmPassword?: unknown
  } | null

  const currentPassword =
    typeof body?.currentPassword === "string" ? body.currentPassword : ""
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : ""
  const confirmPassword =
    typeof body?.confirmPassword === "string" ? body.confirmPassword : ""

  const errors: Record<string, string> = {}

  if (!currentPassword) errors.currentPassword = "Enter your current password"
  if (!newPassword) errors.newPassword = "Enter a new password"

  const problem = newPassword ? validatePassword(newPassword) : null
  if (problem) errors.newPassword = problem

  if (newPassword && confirmPassword !== newPassword) {
    errors.confirmPassword = "Passwords do not match"
  }

  if (newPassword && currentPassword && newPassword === currentPassword) {
    errors.newPassword = "Choose a password you have not used here before"
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 })
  }

  // Read the hash fresh rather than trusting anything cached on the session.
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  })
  if (!record) {
    return NextResponse.json(
      { errors: { form: "Account no longer exists." } },
      { status: 404 }
    )
  }

  const currentOk = await verifyPassword(currentPassword, record.passwordHash)
  if (!currentOk) {
    return NextResponse.json(
      { errors: { currentPassword: "That is not your current password" } },
      { status: 400 }
    )
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  })

  // Everything else signed in as this user is cut off; the tab doing the change
  // keeps working, so a password change is not also an unexpected logout.
  const revoked = await revokeOtherSessions(user.id, user.sessionId)

  return NextResponse.json({ ok: true, signedOutElsewhere: revoked })
}
