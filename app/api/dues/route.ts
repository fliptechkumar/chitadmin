import { NextResponse } from "next/server"
import type { Prisma } from "@/lib/generated/prisma"

import { prisma } from "@/lib/prisma"
import { authorizeApi } from "@/lib/auth-server"
import { branchScope } from "@/lib/rbac"
import { positionFor } from "@/lib/dues"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

/**
 * GET /api/dues
 *
 * The dues register: one row per seated ticket, reduced to the instalment
 * currently owed. Filters: ?branch, ?groupId, ?ticketNo, ?q (name, mobile or
 * applicant code), ?status.
 *
 * Vacant and company seats are excluded — neither owes anything.
 */
export async function GET(request: Request) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const branch = url.searchParams.get("branch")?.trim()
  const groupId = Number(url.searchParams.get("groupId"))
  const ticketNo = Number(url.searchParams.get("ticketNo"))
  const q = url.searchParams.get("q")?.trim()
  const status = url.searchParams.get("status")?.trim()

  const where: Prisma.ChitTicketWhereInput = {
    applicantId: { not: null },
    isCompany: false,
    group: {
      // A Chit Admin only ever sees their own branches' groups. AND, not a
      // spread: spreading would let ?branch= overwrite the scope on the same
      // key, handing them any branch they name.
      AND: [
        branchScope(auth.user, "branchName"),
        ...(branch ? [{ branchName: branch }] : []),
      ],
    },
    ...(Number.isInteger(groupId) && groupId > 0 ? { groupId } : {}),
    ...(Number.isInteger(ticketNo) && ticketNo > 0 ? { ticketNo } : {}),
    ...(q
      ? {
          applicant: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { applicantCode: { contains: q, mode: "insensitive" } },
              { mobile: { contains: q } },
            ],
          },
        }
      : {}),
  }

  const tickets = await prisma.chitTicket.findMany({
    where,
    select: {
      id: true,
      ticketNo: true,
      isPrized: true,
      prizedOn: true,
      applicant: {
        select: {
          id: true,
          applicantCode: true,
          firstName: true,
          lastName: true,
          mobile: true,
        },
      },
      group: {
        select: { id: true, group: true, branchName: true, amount: true, endDate: true },
      },
      dues: {
        select: { installmentNo: true, dueDate: true, amountDue: true, amountPaid: true },
        orderBy: { installmentNo: "asc" },
      },
    },
    orderBy: [{ groupId: "asc" }, { ticketNo: "asc" }],
  })

  const rows = tickets.map((t) => {
    const position = positionFor(
      t.dues.map((d) => ({ ...d, dueDate: d.dueDate.toISOString() }))
    )

    return {
      ticketId: t.id,
      ticketNo: t.ticketNo,
      accountNo: t.applicant?.applicantCode ?? "",
      name: `${t.applicant?.firstName ?? ""} ${t.applicant?.lastName ?? ""}`.trim(),
      mobile: t.applicant?.mobile ?? "",
      groupId: t.group.id,
      group: t.group.group,
      branch: t.group.branchName,
      value: t.group.amount,
      endDate: t.group.endDate,
      isPrized: t.isPrized,
      installmentNo: position.current?.installmentNo ?? 0,
      dueAmount: position.current?.amountDue ?? 0,
      paidAmount: position.current?.amountPaid ?? 0,
      status: position.status,
      pendingCount: position.pendingCount,
      outstanding: position.outstanding,
    }
  })

  // Status is derived, so it cannot be filtered in SQL without duplicating the
  // rules. The register is per-group and small enough for this to be fine.
  const filtered = status ? rows.filter((r) => r.status === status) : rows

  return NextResponse.json(filtered)
}
