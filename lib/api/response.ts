import { NextResponse } from "next/server"

/**
 * One response shape for the whole v1 surface, so a mobile client can parse
 * every endpoint with the same code path.
 *
 *   success -> { "data": ..., "meta": { ... } }
 *   failure -> { "error": { "code": "...", "message": "...", "fields": { ... } } }
 *
 * The existing /api/* routes keep their old ad-hoc shapes; the web app already
 * depends on them and is not a versioned contract.
 */

export const API_ERROR_CODES = {
  /** No credentials, or a token that is not valid at all. */
  UNAUTHENTICATED: 401,
  /** Signature fine, but past expiry — the client should refresh and retry. */
  TOKEN_EXPIRED: 401,
  /** Authenticated, but not allowed to do this. */
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  /** Input failed validation; `fields` says which. */
  VALIDATION_FAILED: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const

export type ApiErrorCode = keyof typeof API_ERROR_CODES

export type PageMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

export function apiOk<T>(
  data: T,
  init?: { status?: number; meta?: Record<string, unknown> }
): NextResponse {
  return NextResponse.json(
    init?.meta ? { data, meta: init.meta } : { data },
    { status: init?.status ?? 200 }
  )
}

export function apiPage<T>(data: T[], meta: PageMeta): NextResponse {
  return NextResponse.json({ data, meta })
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  options?: { fields?: Record<string, string>; headers?: Record<string, string> }
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(options?.fields ? { fields: options.fields } : {}),
      },
    },
    { status: API_ERROR_CODES[code], headers: options?.headers }
  )
}

/**
 * Wraps a handler so an unexpected throw becomes a clean INTERNAL envelope
 * rather than Next's HTML error page, which a mobile client cannot parse.
 */
export function withApiErrors(
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  return handler().catch((error) => {
    console.error("[api/v1] unhandled error:", error)
    return apiError("INTERNAL", "Something went wrong. Please try again.")
  })
}
