import { rotateRefreshToken } from "@/lib/api/tokens"
import { apiError, apiOk, withApiErrors } from "@/lib/api/response"

/**
 * POST /api/v1/auth/refresh
 *
 * Trades a refresh token for a fresh pair. The old refresh token is rotated
 * out, so the client must store whatever comes back — reusing the previous one
 * will fail.
 */
export async function POST(request: Request) {
  return withApiErrors(async () => {
    const body = (await request.json().catch(() => null)) as {
      refreshToken?: unknown
    } | null

    const refreshToken =
      typeof body?.refreshToken === "string" ? body.refreshToken.trim() : ""

    if (!refreshToken) {
      return apiError("VALIDATION_FAILED", "A refresh token is required.", {
        fields: { refreshToken: "Refresh token is required" },
      })
    }

    const result = await rotateRefreshToken(refreshToken)

    if (!result.ok) {
      // All three mean "sign in again", but the message helps when debugging.
      const message =
        result.reason === "expired"
          ? "This session has expired. Please sign in again."
          : result.reason === "disabled"
            ? "This account has been disabled."
            : "Refresh token is not valid."

      return apiError(
        result.reason === "disabled" ? "FORBIDDEN" : "UNAUTHENTICATED",
        message
      )
    }

    return apiOk(result.tokens)
  })
}
