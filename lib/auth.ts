/**
 * Client-side auth helpers. There is deliberately no credential checking here —
 * identity is established by the server (app/api/auth/*) and carried in an
 * httpOnly cookie the browser cannot read. These functions only talk to it.
 */

import type { Role } from "./roles"

export type SessionUser = {
  id: number
  username: string
  name: string
  email: string
  role: Role
  branches: string[]
}

export type LoginResult =
  | { ok: true; redirectTo: string }
  | { ok: false; message: string }

export async function loginUser(
  username: string,
  password: string
): Promise<LoginResult> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })

  const payload = (await response.json().catch(() => null)) as {
    error?: string
    redirectTo?: string
  } | null

  if (!response.ok) {
    return { ok: false, message: payload?.error ?? "Unable to sign in. Try again." }
  }

  return { ok: true, redirectTo: payload?.redirectTo ?? "/home" }
}

/**
 * Ends the session server-side, then does a full navigation rather than a
 * client route change so no cached server component output survives.
 */
export async function logoutUser(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" })
  } finally {
    window.location.href = "/login"
  }
}
