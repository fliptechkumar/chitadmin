import "server-only"

import { prisma } from "@/lib/prisma"
import { branchScope, type Principal } from "@/lib/rbac"
import {
  UNASSIGNED,
  isoToDisplay,
  scopeKeyFor,
  type DenominationCounts,
  type DenominationReport,
  type DenominationRow,
  type RouteSummary,
} from "@/lib/denomination"

export type ReportFilters = {
  /** yyyy-mm-dd */
  date: string
  branch?: string
  /** A route id, UNASSIGNED, or empty for every route. */
  route?: string
}

const nameKey = (group: string, name: string) =>
  `${group}|${name.trim().replace(/\s+/g, " ").toLowerCase()}`

/**
 * Builds the denomination report for one day.
 *
 * Collections carry a group name and a customer name but no route — the route
 * lives on the seat (ChitTicket). Each receipt is placed on the route of the
 * seat in the same group held by a member of the same name. Receipts with no
 * such seat are reported as unassigned under their branch, so nothing collected
 * drops out of the cash totals.
 *
 * Only paid receipts count: pending and overdue rows record money still owed.
 */
export async function buildDenominationReport(
  user: Principal,
  filters: ReportFilters
): Promise<DenominationReport> {
  const groups = await prisma.chitGroup.findMany({
    where: {
      AND: [
        branchScope(user, "branchName"),
        ...(filters.branch ? [{ branchName: filters.branch }] : []),
      ],
    },
    select: { id: true, group: true, branchName: true },
  })

  const branchOfGroup = new Map(groups.map((g) => [g.group, g.branchName]))
  const groupNames = [...branchOfGroup.keys()]
  const dayStart = new Date(`${filters.date}T00:00:00Z`)

  const [collections, tickets, routes, tallies] = await Promise.all([
    prisma.collection.findMany({
      where: {
        date: isoToDisplay(filters.date),
        status: "paid",
        group: { in: groupNames },
      },
      select: {
        id: true,
        receiptNo: true,
        createdAt: true,
        customerName: true,
        group: true,
        installment: true,
        mode: true,
        amount: true,
        penalty: true,
        collectedBy: true,
        routeId: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.chitTicket.findMany({
      where: {
        groupId: { in: groups.map((g) => g.id) },
        routeId: { not: null },
        applicantId: { not: null },
      },
      select: {
        routeId: true,
        group: { select: { group: true } },
        applicant: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.route.findMany({
      where: {
        AND: [
          branchScope(user, "branch"),
          ...(filters.branch ? [{ branch: filters.branch }] : []),
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        branch: true,
        executives: {
          select: { employee: { select: { name: true } } },
          orderBy: { position: "asc" },
        },
      },
    }),
    prisma.cashDenomination.findMany({
      where: {
        date: dayStart,
        branch: { in: [...new Set(groups.map((g) => g.branchName))] },
      },
      select: {
        scopeKey: true,
        counts: true,
        total: true,
        remarks: true,
        updatedAt: true,
        countedBy: { select: { name: true } },
      },
    }),
  ])

  const routeOfMember = new Map<string, number>()
  for (const t of tickets) {
    if (!t.applicant || t.routeId === null) continue
    const full = `${t.applicant.firstName} ${t.applicant.lastName}`
    routeOfMember.set(nameKey(t.group.group, full), t.routeId)
  }

  const routeById = new Map(routes.map((r) => [r.id, r]))

  let rows: DenominationRow[] = collections.map((c) => {
    // Receipts from the route app record their route; older ones are placed
    // by the member's seat.
    const routeId = c.routeId ?? routeOfMember.get(nameKey(c.group, c.customerName)) ?? null
    return {
      id: c.id,
      receiptNo: c.receiptNo,
      createdAt: c.createdAt.toISOString(),
      customerName: c.customerName,
      group: c.group,
      installment: c.installment,
      mode: c.mode,
      amount: c.amount,
      penalty: c.penalty,
      total: c.amount + c.penalty,
      collectedBy: c.collectedBy,
      branch: branchOfGroup.get(c.group) ?? "",
      // A seat can point at a route outside the caller's scope only through
      // bad data; treat it as unassigned rather than leak the route.
      routeId: routeId !== null && routeById.has(routeId) ? routeId : null,
    }
  })

  if (filters.route === UNASSIGNED) {
    rows = rows.filter((r) => r.routeId === null)
  } else if (filters.route) {
    const id = Number(filters.route)
    rows = rows.filter((r) => r.routeId === id)
  }

  const tallyByKey = new Map(tallies.map((t) => [t.scopeKey, t]))
  const summaries = new Map<string, RouteSummary>()

  const ensure = (branch: string, routeId: number | null) => {
    const key = scopeKeyFor(branch, routeId)
    let summary = summaries.get(key)
    if (!summary) {
      const route = routeId !== null ? routeById.get(routeId) : undefined
      const tally = tallyByKey.get(key)
      summary = {
        key,
        branch,
        routeId,
        code: route?.code ?? "—",
        name: route?.name ?? "Unassigned receipts",
        executives: route?.executives.map((e) => e.employee.name) ?? [],
        receipts: 0,
        cash: 0,
        online: 0,
        cheque: 0,
        total: 0,
        tally: tally
          ? {
              counts: (tally.counts ?? {}) as DenominationCounts,
              total: tally.total,
              remarks: tally.remarks ?? "",
              countedBy: tally.countedBy?.name ?? "",
              updatedAt: tally.updatedAt.toISOString(),
            }
          : null,
      }
      summaries.set(key, summary)
    }
    return summary
  }

  // A selected route always gets a row, so its cash can be counted even on a
  // day with no receipts.
  if (filters.route && filters.route !== UNASSIGNED) {
    const route = routeById.get(Number(filters.route))
    if (route) ensure(route.branch, route.id)
  }

  for (const row of rows) {
    const summary = ensure(row.branch, row.routeId)
    summary.receipts += 1
    summary[row.mode] += row.total
    summary.total += row.total
  }

  // Cash already counted for a route stays visible even if its receipts were
  // later corrected away — otherwise a saved tally would silently vanish.
  for (const tally of tallies) {
    if (summaries.has(tally.scopeKey)) continue
    const [branch, rawRoute] = tally.scopeKey.split("|")
    const routeId = rawRoute === "-" ? null : Number(rawRoute)
    if (filters.route === UNASSIGNED && routeId !== null) continue
    if (filters.route && filters.route !== UNASSIGNED && routeId !== Number(filters.route)) continue
    if (routeId !== null && !routeById.has(routeId)) continue
    ensure(branch, routeId)
  }

  const routeList = [...summaries.values()].sort(
    (a, b) =>
      a.branch.localeCompare(b.branch) ||
      // Unassigned last within its branch.
      Number(a.routeId === null) - Number(b.routeId === null) ||
      a.code.localeCompare(b.code, undefined, { numeric: true })
  )

  return { date: filters.date, rows, routes: routeList }
}
