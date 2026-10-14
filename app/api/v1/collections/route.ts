import { Prisma } from "@/lib/generated/prisma"

import { prisma } from "@/lib/prisma"
import { authenticateBearer } from "@/lib/api/auth"
import { apiError, apiOk, apiPage, withApiErrors } from "@/lib/api/response"
import { pageMeta, pageParams, searchTerm } from "@/lib/api/pagination"
import { collectionScope, branchForGroup } from "@/lib/api/collection-scope"
import { buildReceipt } from "@/lib/api/receipt"
import { canAccessBranch } from "@/lib/rbac"
import { parseCollectionInput } from "@/lib/collection-schema"
import { todayDisplay } from "@/lib/format"

const COLLECTOR_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

const LIST_SELECT = {
  id: true,
  receiptNo: true,
  customerId: true,
  customerName: true,
  group: true,
  installment: true,
  amount: true,
  penalty: true,
  mode: true,
  date: true,
  status: true,
  collectedBy: true,
} satisfies Prisma.CollectionSelect

/**
 * GET /api/v1/collections
 *
 * Paginated, newest id first. Filters: ?status, ?customerId, ?group, ?q
 * (receipt number or customer name).
 */
export async function GET(request: Request) {
  return withApiErrors(async () => {
    const auth = await authenticateBearer(request, COLLECTOR_ROLES)
    if (!auth.ok) return auth.response

    const params = pageParams(request)
    const url = new URL(request.url)
    const q = searchTerm(request)

    const status = url.searchParams.get("status")
    const customerId = Number(url.searchParams.get("customerId"))
    const group = url.searchParams.get("group")

    const where: Prisma.CollectionWhereInput = {
      ...(await collectionScope(auth.user)),
      ...(status ? { status: status as Prisma.EnumCollectionStatusFilter["equals"] } : {}),
      ...(Number.isInteger(customerId) && customerId > 0 ? { customerId } : {}),
      ...(group ? { group } : {}),
      ...(q
        ? {
            OR: [
              { receiptNo: { contains: q, mode: "insensitive" } },
              { customerName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    }

    const [rows, total] = await Promise.all([
      prisma.collection.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { id: "desc" },
        skip: params.skip,
        take: params.take,
      }),
      prisma.collection.count({ where }),
    ])

    return apiPage(rows, pageMeta(params, total))
  })
}

/**
 * POST /api/v1/collections
 *
 * Records a payment and returns the receipt, so the app can print straight
 * from the response without a second round trip.
 */
export async function POST(request: Request) {
  return withApiErrors(async () => {
    const auth = await authenticateBearer(request, COLLECTOR_ROLES)
    if (!auth.ok) return auth.response

    const parsed = parseCollectionInput(await request.json().catch(() => null))
    if (!parsed.ok) {
      return apiError("VALIDATION_FAILED", "Check the highlighted fields.", {
        fields: parsed.errors,
      })
    }

    const input = parsed.data

    const branch = await branchForGroup(input.group)
    if (!branch) {
      return apiError("NOT_FOUND", `No chit group named "${input.group}".`, {
        fields: { group: "Unknown group" },
      })
    }

    if (!canAccessBranch(auth.user, branch)) {
      return apiError("FORBIDDEN", `You are not assigned to the ${branch} branch.`)
    }

    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
      select: { id: true, name: true, phone: true, pendingDue: true },
    })
    if (!customer) {
      return apiError("NOT_FOUND", "Customer not found.", {
        fields: { customerId: "Unknown customer" },
      })
    }

    const created = await prisma.$transaction(async (tx) => {
      // Receipt numbers must be unique and are sequential per year. Derived
      // from the row id so two agents collecting at once cannot collide.
      const row = await tx.collection.create({
        data: {
          receiptNo: `TEMP-${crypto.randomUUID()}`,
          customerId: customer.id,
          customerName: customer.name,
          group: input.group,
          installment: input.installment,
          amount: input.amount,
          penalty: input.penalty,
          mode: input.mode,
          date: todayDisplay(),
          collectedBy: auth.user.name,
          status: input.status,
        },
        select: { id: true },
      })

      const receiptNo = `RCP-${new Date().getFullYear()}-${String(row.id).padStart(4, "0")}`

      const collection = await tx.collection.update({
        where: { id: row.id },
        data: { receiptNo },
        select: { ...LIST_SELECT, customer: { select: { phone: true } } },
      })

      // A recorded payment moves the customer's ledger; anything not actually
      // paid (pending/overdue) is only a record and leaves the balance alone.
      if (input.status === "paid") {
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            totalPaid: { increment: input.amount },
            pendingDue: Math.max(0, customer.pendingDue - input.amount),
          },
        })
      }

      return collection
    })

    return apiOk(
      { collection: created, receipt: await buildReceipt(created) },
      { status: 201 }
    )
  })
}
