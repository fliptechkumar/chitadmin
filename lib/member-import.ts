import "server-only"

import { prisma } from "@/lib/prisma"
import { splitName, type SheetRow } from "@/lib/member-sheet"

/**
 * Applies uploaded Advance Preparation rows to the member register: a member
 * whose account number is already on file is updated, a new one is added, and
 * either way they are seated on the ticket the sheet names.
 *
 * Unlike scripts/import-members.ts this never creates routes, staff or groups
 * — an upload from Settings changes member data only. Rows pointing at a group
 * or seat the register does not have are reported back rather than guessed at.
 *
 * Planning reads everything up front and decides every write before any is
 * made, so the preview and the real run produce the same report.
 */

export type SkippedRow = {
  file: string
  rowNo: number
  accountNo: string
  name: string
  why: string
}

export type MemberImportReport = {
  applied: boolean
  rows: number
  created: number
  updated: number
  unchanged: number
  seated: number
  /** Seats that held someone else before this upload. */
  replaced: number
  skipped: SkippedRow[]
}

/** The applicant fields the sheet owns. Everything else (KYC, nominee,
 *  address) is left as keyed in, so an upload never blanks it. */
type MemberFields = {
  branch: string
  firstName: string
  lastName: string
  mobile: string
  area: string
  chitValue: number
  status: "allocated"
}

type Plan = {
  row: SheetRow
  existingId: number | null
  fields: MemberFields
  changed: boolean
  seatId: number
  groupId: number
  routeId: number | null
  seatChanged: boolean
  /** Other seats in the same group this member held and is leaving. */
  vacate: number[]
}

function fieldsFor(row: SheetRow): MemberFields {
  const { firstName, lastName } = splitName(row.name)
  return {
    branch: row.branch,
    firstName,
    lastName,
    mobile: row.mobile,
    area: row.area,
    chitValue: row.chitValue,
    // They hold a seat, which is what allocated means here.
    status: "allocated",
  }
}

export async function importMembers(
  rows: SheetRow[],
  { apply }: { apply: boolean }
): Promise<MemberImportReport> {
  const report: MemberImportReport = {
    applied: false,
    rows: rows.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    seated: 0,
    replaced: 0,
    skipped: [],
  }
  const skip = (row: SheetRow, why: string) =>
    report.skipped.push({
      file: row.file,
      rowNo: row.rowNo,
      accountNo: row.accountNo,
      name: row.name,
      why,
    })

  const [groups, routes, applicants] = await Promise.all([
    prisma.chitGroup.findMany({
      where: { group: { in: [...new Set(rows.map((r) => r.group))] } },
      select: { id: true, group: true },
    }),
    prisma.route.findMany({
      where: { code: { in: [...new Set(rows.map((r) => r.routeCode))] } },
      select: { id: true, code: true },
    }),
    prisma.applicant.findMany({
      where: { applicantCode: { in: rows.map((r) => r.accountNo) } },
      select: {
        id: true,
        applicantCode: true,
        branch: true,
        firstName: true,
        lastName: true,
        mobile: true,
        area: true,
        chitValue: true,
        status: true,
      },
    }),
  ])

  const groupIdByName = new Map(groups.map((g) => [g.group, g.id]))
  const routeIdByCode = new Map(routes.map((r) => [r.code, r.id]))
  const applicantByCode = new Map(applicants.map((a) => [a.applicantCode, a]))

  const tickets = await prisma.chitTicket.findMany({
    where: { groupId: { in: groups.map((g) => g.id) } },
    select: {
      id: true,
      groupId: true,
      ticketNo: true,
      isCompany: true,
      applicantId: true,
      routeId: true,
      isPrized: true,
    },
  })
  const seatByKey = new Map(tickets.map((t) => [`${t.groupId}#${t.ticketNo}`, t]))

  const plans: Plan[] = []

  for (const row of rows) {
    if (!row.accountNo) {
      skip(row, "no account number")
      continue
    }
    if (!row.name) {
      skip(row, "no name")
      continue
    }
    if (!Number.isInteger(row.ticketNo) || row.ticketNo < 1) {
      skip(row, "ticket number is not a whole number")
      continue
    }
    if (!Number.isFinite(row.chitValue)) {
      skip(row, "chit value is not a number")
      continue
    }

    const groupId = groupIdByName.get(row.group)
    if (!groupId) {
      skip(row, `group ${row.group || "(blank)"} is not in the register`)
      continue
    }

    // The seat is matched, never created: a ticket number outside the group's
    // roster is a disagreement between the two registers, and silently adding
    // a seat would paper over it.
    const seat = seatByKey.get(`${groupId}#${row.ticketNo}`)
    if (!seat) {
      skip(row, `${row.group} has no seat ${row.ticketNo}`)
      continue
    }
    if (seat.isCompany) {
      skip(row, `${row.group} seat ${row.ticketNo} is the company seat`)
      continue
    }

    const fields = fieldsFor(row)
    const existing = applicantByCode.get(row.accountNo) ?? null
    const changed =
      !existing ||
      (Object.keys(fields) as (keyof MemberFields)[]).some(
        (key) => (existing[key] ?? "") !== fields[key]
      )

    const routeId = routeIdByCode.get(row.routeCode) ?? null
    const seatChanged =
      !existing ||
      seat.applicantId !== existing.id ||
      seat.routeId !== routeId ||
      seat.isPrized !== row.isPrized

    const vacate = existing
      ? tickets
          .filter(
            (t) => t.groupId === groupId && t.applicantId === existing.id && t.id !== seat.id
          )
          .map((t) => t.id)
      : []

    if (!existing) report.created++
    else if (changed) report.updated++
    else report.unchanged++

    if (seatChanged) report.seated++
    if (seat.applicantId !== null && seat.applicantId !== existing?.id) report.replaced++

    plans.push({
      row,
      existingId: existing?.id ?? null,
      fields,
      changed,
      seatId: seat.id,
      groupId,
      routeId,
      seatChanged,
      vacate,
    })
  }

  // A seat someone leaves may be the seat someone else in this same upload is
  // taking; clearing it after they sat down would unseat them again.
  const targeted = new Set(plans.map((p) => p.seatId))
  for (const plan of plans) plan.vacate = plan.vacate.filter((id) => !targeted.has(id))

  if (!apply) return report

  const touchedGroups = new Set<number>()

  await prisma.$transaction(
    async (tx) => {
      for (const plan of plans) {
        let applicantId = plan.existingId

        if (applicantId === null) {
          const created = await tx.applicant.create({
            data: { applicantCode: plan.row.accountNo, ...plan.fields },
            select: { id: true },
          })
          applicantId = created.id
        } else if (plan.changed) {
          await tx.applicant.update({ where: { id: applicantId }, data: plan.fields })
        }

        if (plan.vacate.length > 0) {
          await tx.chitTicket.updateMany({
            where: { id: { in: plan.vacate } },
            data: { applicantId: null, assignedAt: null },
          })
          touchedGroups.add(plan.groupId)
        }

        if (plan.seatChanged) {
          await tx.chitTicket.update({
            where: { id: plan.seatId },
            data: {
              applicantId,
              routeId: plan.routeId,
              isPrized: plan.row.isPrized,
              status: "active",
              assignedAt: new Date(),
            },
          })
          touchedGroups.add(plan.groupId)
        }
      }

      // The counters the groups list reads, for every group whose seats moved.
      for (const groupId of touchedGroups) {
        const [taken, total] = await Promise.all([
          tx.chitTicket.count({ where: { groupId, applicantId: { not: null } } }),
          tx.chitTicket.count({ where: { groupId } }),
        ])
        await tx.chitGroup.update({
          where: { id: groupId },
          data: { members: taken, vacants: total - taken },
        })
      }
    },
    { timeout: 120_000, maxWait: 15_000 }
  )

  report.applied = true
  return report
}
