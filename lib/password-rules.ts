/**
 * Password policy, kept free of server-only imports so the same rule runs in
 * the browser form and in the API handler.
 */

export type PasswordProblem = string | null

/**
 * The same rules broken out individually, so a form can show which are met as
 * the user types rather than revealing one failure at a time.
 */
export function passwordChecks(plain: string) {
  return [
    { label: "At least 8 characters", met: plain.length >= 8 },
    { label: "Contains a letter", met: /[a-zA-Z]/.test(plain) },
    { label: "Contains a number", met: /[0-9]/.test(plain) },
  ]
}

/** Minimum bar for an admin portal password. Returns null when acceptable. */
export function validatePassword(plain: string): PasswordProblem {
  if (plain.length < 8) return "Password must be at least 8 characters"
  if (plain.length > 200) return "Password must be at most 200 characters"
  if (!/[a-zA-Z]/.test(plain)) return "Password must contain a letter"
  if (!/[0-9]/.test(plain)) return "Password must contain a number"
  return null
}
