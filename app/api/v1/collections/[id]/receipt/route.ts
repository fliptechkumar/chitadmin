import { prisma } from "@/lib/prisma"
import { authenticateBearer } from "@/lib/api/auth"
import { apiError, apiOk, withApiErrors } from "@/lib/api/response"
import { branchForGroup } from "@/lib/api/collection-scope"
import { buildReceipt } from "@/lib/api/receipt"
import { canAccessBranch } from "@/lib/rbac"

type Context = { params: Promise<{ id: string }> }

const COLLECTOR_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN", "ROUTE"] as const

/**
 * GET /api/v1/collections/{id}/receipt
 *
 * Reprints an earlier receipt — the same payload POST /collections returns, so
 * the app has one rendering path for both.
 */
export async function GET(request: Request, { params }: Context) {
  return withApiErrors(async () => {
    const auth = await authenticateBearer(request, COLLECTOR_ROLES)
    if (!auth.ok) return auth.response

    const id = Number((await params).id)
    if (!Number.isInteger(id)) {
      return apiError("VALIDATION_FAILED", "Invalid collection id.")
    }

    const collection = await prisma.collection.findUnique({
      where: { id },
      select: {
        receiptNo: true,
        date: true,
        customerId: true,
        customerName: true,
        group: true,
        installment: true,
        amount: true,
        penalty: true,
        mode: true,
        status: true,
        collectedBy: true,
        customer: { select: { phone: true } },
      },
    })

    if (!collection) return apiError("NOT_FOUND", "Collection not found.")

    // Scope is checked after the lookup so the branch can be resolved from the
    // group; a row outside scope is refused rather than silently 404'd.
    const branch = await branchForGroup(collection.group)
    if (branch && !canAccessBranch(auth.user, branch)) {
      return apiError("FORBIDDEN", `You are not assigned to the ${branch} branch.`)
    }

    return apiOk(await buildReceipt(collection))
  })
}
