import { authenticateBearer } from "@/lib/api/auth"
import { apiOk, withApiErrors } from "@/lib/api/response"

/**
 * GET /api/v1/me
 *
 * The signed-in user. Useful on app start to confirm a stored token still
 * works and to pick up a role or branch change without re-authenticating.
 */
export async function GET(request: Request) {
  return withApiErrors(async () => {
    const auth = await authenticateBearer(request)
    if (!auth.ok) return auth.response

    const { id, username, name, email, role, branches } = auth.user
    return apiOk({ id, username, name, email, role, branches })
  })
}
