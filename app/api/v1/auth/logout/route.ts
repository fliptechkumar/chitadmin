import { revokeRefreshToken } from "@/lib/api/tokens"
import { apiError, apiOk, withApiErrors } from "@/lib/api/response"

/**
 * POST /api/v1/auth/logout
 *
 * Deletes the session behind the refresh token. Responds 200 even when the
 * token is already unknown, so signing out twice is not an error the app has
 * to handle.
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

    const revoked = await revokeRefreshToken(refreshToken)
    return apiOk({ revoked })
  })
}
