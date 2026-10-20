/**
 * Company profile shape, defaults and validation. No server imports, so the
 * settings form and the API handler share one set of rules.
 */

export type CompanyProfile = {
  name: string
  shortName: string
  regNo: string
  gst: string
  phone: string
  email: string
  website: string
  addressLine: string
  city: string
  state: string
  pincode: string
  /** Data URI, or "" for none. */
  logo: string
}

export type CompanyErrors = Partial<Record<keyof CompanyProfile, string>>

/**
 * Used before anyone has saved settings, and as the fallback if the row is
 * missing — the portal should never render blank branding.
 */
export const COMPANY_DEFAULTS: CompanyProfile = {
  name: "MIK Finance Pvt Ltd",
  shortName: "ChitAdmin",
  regNo: "",
  gst: "",
  phone: "",
  email: "",
  website: "",
  addressLine: "",
  city: "",
  state: "",
  pincode: "",
  logo: "",
}

/** Logos are inlined into the database, so keep them small. */
export const MAX_LOGO_BYTES = 500 * 1024
export const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PINCODE_RE = /^[1-9]\d{5}$/
const DATA_URI_RE = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i

/** Approximate decoded size of a base64 payload, without decoding it. */
export function base64Bytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

/** Returns a problem with the logo data URI, or null when acceptable. */
export function validateLogo(logo: string): string | null {
  if (!logo) return null

  const match = DATA_URI_RE.exec(logo)
  if (!match) return "Logo must be an image file"

  const [, mime, base64] = match
  if (!ALLOWED_LOGO_TYPES.includes(mime.toLowerCase())) {
    return "Use a PNG, JPEG, WebP or SVG image"
  }

  if (base64Bytes(base64) > MAX_LOGO_BYTES) {
    return `Logo must be under ${Math.round(MAX_LOGO_BYTES / 1024)}KB`
  }

  return null
}

type ParseResult =
  | { ok: true; data: CompanyProfile }
  | { ok: false; errors: CompanyErrors }

export function parseCompanyInput(raw: unknown): ParseResult {
  const body = (raw ?? {}) as Record<string, unknown>
  const errors: CompanyErrors = {}

  const read = (key: keyof CompanyProfile) =>
    typeof body[key] === "string" ? (body[key] as string).trim() : ""

  const data: CompanyProfile = {
    name: read("name"),
    shortName: read("shortName"),
    regNo: read("regNo"),
    gst: read("gst"),
    phone: read("phone"),
    email: read("email"),
    website: read("website"),
    addressLine: read("addressLine"),
    city: read("city"),
    state: read("state"),
    pincode: read("pincode"),
    // Not trimmed through `read` — a data URI can be long but never padded.
    logo: typeof body.logo === "string" ? body.logo.trim() : "",
  }

  // Both names appear in the UI and on receipts, so neither may be blank.
  if (!data.name) errors.name = "Company name is required"
  else if (data.name.length > 120) errors.name = "Company name is too long"

  if (!data.shortName) errors.shortName = "Short name is required"
  else if (data.shortName.length > 40) errors.shortName = "Keep the short name under 40 characters"

  if (data.email && !EMAIL_RE.test(data.email)) {
    errors.email = "Enter a valid email address"
  }

  if (data.pincode && !PINCODE_RE.test(data.pincode)) {
    errors.pincode = "Enter a 6-digit pincode"
  }

  const logoProblem = validateLogo(data.logo)
  if (logoProblem) errors.logo = logoProblem

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, data }
}
