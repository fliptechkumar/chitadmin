/**
 * Seats the members held in the branch's Advance Preparation sheets — one
 * spreadsheet per collection route — onto the chit groups already imported
 * from chitpro.
 *
 * Each sheet row is one *seat*, not one person: a subscriber holding two
 * tickets appears twice, under two account numbers. The account number is
 * therefore what an Applicant is keyed on, and it becomes the applicant code
 * the dues register already displays as "Account No". Mobile deliberately is
 * not the key — 168 numbers in these sheets carry more than one name (families
 * and shops share a handset), and merging on it would fuse distinct people
 * into one record.
 *
 * Re-runnable: every write is an upsert or an update keyed on something stable
 * (route code, applicant code, group + ticket number), so running twice lands
 * the same register rather than a doubled one.
 *
 * Must run AFTER scripts/import-chitpro-groups.ts, never before: that script
 * wipes the group register and cascades through the seats, which would delete
 * every assignment made here.
 *
 * Usage:
 *   npx tsx scripts/import-members.ts --dry          # map and report, write nothing
 *   npx tsx scripts/import-members.ts
 *   npx tsx scripts/import-members.ts --dir data/members
 */
import { PrismaClient, type Prisma, type GroupStatus } from "../lib/generated/prisma"
import { readdir } from "node:fs/promises"
import { join, extname } from "node:path"
import ExcelJS from "exceljs"

const prisma = new PrismaClient()

/** Where the sheets live unless --dir says otherwise. Gitignored: real PII. */
const DEFAULT_DIR = "data/members"
/** The header sits on row 6 under a four-line banner; data starts below it. */
const HEADER_ROW = 6
const FIRST_DATA_ROW = 7
/** The hour branches open the hall, matching lib/group-schedule.ts. */
const AUCTION_TIME = "10:00"

/** Columns, 1-based, as the Advance Preparation export lays them out. */
const COL = {
  branch: 2,
  accountNo: 3,
  dueDate: 4,
  name: 5,
  area: 6,
  mobile: 7,
  ticketNo: 8,
  group: 9,
  chitValue: 10,
  currentDue: 13,
  staff: 15,
  prizedStatus: 17,
} as const

/** The header each column must carry, so a re-exported sheet cannot shift
 *  silently underneath the mapping above and seat members on wrong tickets. */
const EXPECTED_HEADERS: Record<number, string> = {
  [COL.branch]: "Branch",
  [COL.accountNo]: "Account No",
  [COL.dueDate]: "Due Date",
  [COL.name]: "Name",
  [COL.area]: "Area",
  [COL.mobile]: "Mobile No",
  [COL.ticketNo]: "Ticket No",
  [COL.group]: "Group",
  [COL.chitValue]: "Chit Value",
  [COL.currentDue]: "Current Due",
  [COL.staff]: "Staff",
  [COL.prizedStatus]: "Prized Status",
}

/**
 * Chit value to plan name. The source names a plan "<value>-<bid ceiling>",
 * and every group already imported follows this map exactly — it is only
 * consulted for groups the chitpro register has not caught up with yet.
 */
const PLAN_BY_VALUE: Record<number, string> = {
  50_000: "50K-25",
  100_000: "1L-25",
  200_000: "2L-25",
  300_000: "3L-25",
  500_000: "5L-25",
  1_000_000: "10L-25",
  2_000_000: "20L-25",
}

/** Seats a group runs, and so also the months it runs for. */
const DEFAULT_SEATS = 20

type SheetRow = {
  file: string
  routeCode: string
  routeName: string
  branch: string
  accountNo: string
  dueDate: string
  name: string
  area: string
  mobile: string
  ticketNo: number
  group: string
  chitValue: number
  currentDue: number | null
  staff: string[]
  isPrized: boolean
}

/** A cell as trimmed text; ExcelJS hands back dates and formulas as objects. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) {
    // Local parts, not toISOString: a date cell is local midnight, and in any
    // positive-offset timezone its UTC form is the day before.
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  }
  if (typeof value === "object") {
    if ("text" in value) return String(value.text)
    if ("result" in value) return String(value.result ?? "")
    if ("richText" in value) return value.richText.map((part) => part.text).join("")
    if ("hyperlink" in value) return String(value.hyperlink)
    return JSON.stringify(value)
  }
  return String(value)
}

/**
 * "R01-KODUMBALUR" -> code R01, name Kodumbalur. The office round carries no
 * number; it keeps OFFICE as its code so it still sorts and reads as a route.
 */
function parseRoute(banner: string): { code: string; name: string } {
  const raw = banner.replace(/^Route:\s*/i, "").trim()
  const match = /^(R\d+)-(.+)$/.exec(raw)
  if (!match) return { code: raw.toUpperCase(), name: titleCase(raw) }
  return { code: match[1].toUpperCase(), name: titleCase(match[2]) }
}

/**
 * Sheets shout their text; the register displays it as written elsewhere.
 * Short all-capital tokens are left alone — a route named "PTM" is an
 * abbreviation, and "Ptm" would be a misspelling of it rather than a tidier
 * one.
 */
function titleCase(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .map((word) =>
      word.length <= 3 && word === word.toUpperCase()
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(" ")
}

/**
 * Splits a written name into the register's two fields. Names here are given
 * name followed by an initial ("SARAVANAN N"), so the last token is the
 * surname and everything before it the given name. A single-token name keeps
 * an empty surname rather than borrowing one.
 */
function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: "", lastName: "" }
  if (parts.length === 1) return { firstName: parts[0], lastName: "" }
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] }
}

/** "2026-09-05" plus n months, clamped to the target month's last day. */
function addMonths(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number)
  const lastOfTarget = new Date(y, m - 1 + months + 1, 0).getDate()
  return new Date(y, m - 1 + months, Math.min(d, lastOfTarget))
}

/** "2026-09-05" -> "05/09/2026", the form the register stores dates in. */
function toDisplayDate(iso: string) {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

function toIso(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * The register keeps no status of its own: a group is simply on it. Status is
 * read off the dates, which is what the register means by the word.
 */
function statusFor(start: Date, end: Date, today: Date): GroupStatus {
  if (end < today) return "completed"
  if (start > today) return "upcoming"
  return "active"
}

/** Whole months from start to end inclusive, both dd/MM/yyyy. */
function monthsBetween(startDate: string, endDate: string) {
  const [, sm, sy] = startDate.split("/").map(Number)
  const [, em, ey] = endDate.split("/").map(Number)
  return (ey - sy) * 12 + (em - sm) + 1
}

async function readSheets(dir: string): Promise<SheetRow[]> {
  const entries = await readdir(dir)
  const files = entries
    .filter((name) => !name.startsWith("~$") && extname(name).toLowerCase() === ".xlsx")
    .sort()
  if (files.length === 0) throw new Error(`No .xlsx files in ${dir}`)

  const rows: SheetRow[] = []

  for (const file of files) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(join(dir, file))
    const sheet = workbook.worksheets[0]
    if (!sheet) throw new Error(`${file}: no sheets`)

    // A shifted column would silently seat people on the wrong tickets, so the
    // layout is checked before a single row is read.
    for (const [index, expected] of Object.entries(EXPECTED_HEADERS)) {
      const actual = cellText(sheet.getRow(HEADER_ROW).getCell(Number(index)).value).trim()
      if (actual.toLowerCase() !== expected.toLowerCase()) {
        throw new Error(
          `${file}: expected "${expected}" in column ${index} of row ${HEADER_ROW}, found "${actual}"`
        )
      }
    }

    const { code: routeCode, name: routeName } = parseRoute(
      cellText(sheet.getRow(2).getCell(1).value)
    )

    for (let r = FIRST_DATA_ROW; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r)
      const get = (col: number) => cellText(row.getCell(col).value).trim()

      const accountNo = get(COL.accountNo)
      const name = get(COL.name)
      // rowCount counts trailing formatted-but-empty rows; those stop here.
      if (!accountNo && !name) continue

      const ticketNo = Number(get(COL.ticketNo))
      const chitValue = Number(get(COL.chitValue))
      const currentDue = Number(get(COL.currentDue))

      rows.push({
        file,
        routeCode,
        routeName,
        branch: get(COL.branch),
        accountNo,
        dueDate: get(COL.dueDate),
        name,
        area: get(COL.area),
        // Sheets vary between "9787415767" and "98765 43211".
        mobile: get(COL.mobile).replace(/\D/g, ""),
        ticketNo,
        group: get(COL.group),
        chitValue,
        currentDue: Number.isFinite(currentDue) && currentDue > 0 ? currentDue : null,
        staff: get(COL.staff)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        isPrized: get(COL.prizedStatus).toLowerCase() === "prized",
      })
    }
  }

  return rows
}

/**
 * Builds the groups the sheets refer to that the chit register has not got
 * yet. Only the plan is looked up; the dates are read back out of the sheet —
 * a row's "Current Due" is its installment number, so a group whose 8th
 * installment falls due on 2026-09-05 commenced seven months before that.
 * Checked against all 153 groups present in both registers, this agrees on
 * every one, which is why it is derived rather than defaulted.
 */
function deriveGroup(rows: SheetRow[], today: Date) {
  const sample = rows.find((r) => r.currentDue !== null && r.dueDate) ?? rows[0]
  const chitValue = sample.chitValue
  const percentage = PLAN_BY_VALUE[chitValue]
  if (!percentage) return { ok: false as const, why: `no plan for chit value ${chitValue}` }

  const seats = DEFAULT_SEATS
  if (!sample.currentDue || !sample.dueDate) {
    return { ok: false as const, why: "no installment number to date the group from" }
  }

  const startIso = toIso(addMonths(sample.dueDate, -(sample.currentDue - 1)))
  // A group runs one round a month, one per seat.
  const endIso = toIso(addMonths(startIso, seats - 1))

  const start = new Date(`${startIso}T00:00:00`)
  const end = new Date(`${endIso}T00:00:00`)

  return {
    ok: true as const,
    data: {
      branchName: sample.branch,
      specialType: "Regular",
      group: sample.group,
      percentage,
      amount: chitValue,
      startDate: toDisplayDate(startIso),
      endDate: toDisplayDate(endIso),
      totalTickets: seats,
      members: 0,
      vacants: seats,
      status: statusFor(start, end, today),
    },
  }
}

type Report = {
  routes: number
  employees: number
  groupsCreated: string[]
  applicants: number
  seated: number
  skipped: { row: SheetRow; why: string }[]
}

async function main() {
  const args = process.argv.slice(2)
  const dry = args.includes("--dry")
  const dirFlag = args.indexOf("--dir")
  const dir = dirFlag === -1 ? DEFAULT_DIR : args[dirFlag + 1] ?? DEFAULT_DIR

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const rows = await readSheets(dir)
  console.log(`Read ${rows.length} seat rows from ${dir}`)

  // Two rows claiming one seat would make the import order-dependent; the
  // sheets are clean today and this keeps them honest.
  const bySeat = new Map<string, SheetRow>()
  const collisions: string[] = []
  for (const row of rows) {
    const key = `${row.group}#${row.ticketNo}`
    const seen = bySeat.get(key)
    if (seen) collisions.push(`${key}: ${seen.accountNo} (${seen.file}) vs ${row.accountNo} (${row.file})`)
    else bySeat.set(key, row)
  }
  if (collisions.length > 0) {
    console.log(`Refusing: ${collisions.length} seat(s) claimed twice`)
    for (const c of collisions.slice(0, 10)) console.log(`  ${c}`)
    throw new Error("Two rows claim the same seat; fix the sheets first.")
  }

  const duplicateAccounts = rows.length - new Set(rows.map((r) => r.accountNo)).size
  if (duplicateAccounts > 0) {
    throw new Error(`${duplicateAccounts} account number(s) appear on more than one row.`)
  }

  const existing = await prisma.chitGroup.findMany({ select: { id: true, group: true } })
  const groupIdByName = new Map(existing.map((g) => [g.group, g.id]))

  const missingNames = [...new Set(rows.map((r) => r.group))].filter(
    (name) => !groupIdByName.has(name)
  )
  const routeBanners = new Map(rows.map((r) => [r.routeCode, r.routeName]))
  const staffNames = [...new Set(rows.flatMap((r) => r.staff))].sort()

  console.log(
    `Routes: ${routeBanners.size} · staff: ${staffNames.length} · ` +
      `groups referenced: ${new Set(rows.map((r) => r.group)).size} (${missingNames.length} not yet in the register)`
  )

  const derived = missingNames.map((name) => ({
    name,
    result: deriveGroup(
      rows.filter((r) => r.group === name),
      today
    ),
  }))
  for (const d of derived) {
    if (d.result.ok) {
      const g = d.result.data
      console.log(`  will create ${g.group}: ${g.percentage}, ${g.startDate}–${g.endDate}, ${g.totalTickets} seats`)
    } else {
      console.log(`  cannot create ${d.name}: ${d.result.why}`)
    }
  }

  if (dry) {
    console.log("\nDry run — nothing written.")
    return
  }

  const report: Report = {
    routes: 0,
    employees: 0,
    groupsCreated: [],
    applicants: 0,
    seated: 0,
    skipped: [],
  }

  await prisma.$transaction(
    async (tx) => {
      // 1. Routes, keyed on their code so re-running renames rather than doubles.
      const routeIdByCode = new Map<string, number>()
      for (const [code, name] of [...routeBanners].sort()) {
        const areas = [
          ...new Set(rows.filter((r) => r.routeCode === code).map((r) => r.area)),
        ].sort()
        const branch = rows.find((r) => r.routeCode === code)?.branch ?? ""
        const route = await tx.route.upsert({
          where: { code },
          create: { code, name, branch, areas },
          update: { name, branch, areas },
        })
        routeIdByCode.set(code, route.id)
        report.routes++
      }

      // 2. Field staff. The sheets give a name and nothing else, so the rest of
      // an employee record is left blank for the branch to fill in; matching is
      // on name within the branch, which is all there is to match on.
      const employeeIdByName = new Map<string, number>()
      for (const name of staffNames) {
        const branch = rows.find((r) => r.staff.includes(name))?.branch ?? ""
        const found = await tx.employee.findFirst({
          where: { name: { equals: name, mode: "insensitive" }, branch },
          select: { id: true },
        })
        if (found) {
          employeeIdByName.set(name, found.id)
          continue
        }
        const created = await tx.employee.create({
          data: {
            name,
            role: "Agent",
            branch,
            phone: "",
            email: "",
            joinedDate: "",
          },
          select: { id: true },
        })
        employeeIdByName.set(name, created.id)
        report.employees++
      }

      // 3. Staff onto the routes they collect for, ordered by name so the
      // listing is stable between runs. The sheets are the whole truth about
      // who collects where, so anyone else standing on an imported route is
      // removed rather than left alongside — otherwise seeded placeholder
      // staff would read as real collectors on a real round.
      for (const [code, routeId] of routeIdByCode) {
        const onRoute = [
          ...new Set(rows.filter((r) => r.routeCode === code).flatMap((r) => r.staff)),
        ].sort()
        const employeeIds = onRoute
          .map((name) => employeeIdByName.get(name))
          .filter((id): id is number => id !== undefined)

        await tx.routeExecutive.deleteMany({
          where: { routeId, employeeId: { notIn: employeeIds } },
        })

        for (const [position, employeeId] of employeeIds.entries()) {
          await tx.routeExecutive.upsert({
            where: { routeId_employeeId: { routeId, employeeId } },
            create: { routeId, employeeId, position },
            update: { position },
          })
        }
      }

      // 4. Groups the chit register has not caught up with, each with the
      // roster and the monthly rounds a group needs to be usable.
      for (const { name, result } of derived) {
        if (!result.ok) continue
        const group = await tx.chitGroup.create({ data: result.data })
        groupIdByName.set(name, group.id)
        report.groupsCreated.push(name)

        await tx.chitTicket.createMany({
          data: Array.from({ length: result.data.totalTickets }, (_, i) => ({
            groupId: group.id,
            ticketNo: i + 1,
            isCompany: i === 0,
          })),
        })

        const [d, m, y] = result.data.startDate.split("/").map(Number)
        const rounds = Math.min(
          monthsBetween(result.data.startDate, result.data.endDate),
          result.data.totalTickets
        )
        await tx.auction.createMany({
          data: Array.from({ length: rounds }, (_, i) => ({
            groupId: group.id,
            installmentNo: i + 1,
            auctionDate: new Date(y, m - 1 + i, d),
            auctionTime: AUCTION_TIME,
          })),
        })
      }

      // 5. The members themselves, one per account number.
      for (const row of rows) {
        const groupId = groupIdByName.get(row.group)
        if (!groupId) {
          report.skipped.push({ row, why: `group ${row.group} is not in the register` })
          continue
        }

        const { firstName, lastName } = splitName(row.name)
        const shared: Prisma.ApplicantUncheckedCreateInput = {
          applicantCode: row.accountNo,
          branch: row.branch,
          firstName,
          lastName,
          mobile: row.mobile,
          area: row.area,
          chitValue: row.chitValue,
          // They hold a seat, which is what allocated means here.
          status: "allocated",
        }

        const applicant = await tx.applicant.upsert({
          where: { applicantCode: row.accountNo },
          create: shared,
          // aadhaarNumber is left as it is: the sheets carry no KYC, and an
          // import must not blank a number someone has since keyed in.
          update: {
            branch: shared.branch,
            firstName,
            lastName,
            mobile: shared.mobile,
            area: shared.area,
            chitValue: shared.chitValue,
            status: "allocated",
          },
          select: { id: true },
        })
        report.applicants++

        // The seat is matched, never created: a ticket number outside the
        // group's roster is a disagreement between the two registers, and
        // silently adding a seat would paper over it.
        const seat = await tx.chitTicket.findUnique({
          where: { groupId_ticketNo: { groupId, ticketNo: row.ticketNo } },
          select: { id: true, isCompany: true },
        })
        if (!seat) {
          report.skipped.push({ row, why: `${row.group} has no seat ${row.ticketNo}` })
          continue
        }
        if (seat.isCompany) {
          report.skipped.push({ row, why: `${row.group} seat ${row.ticketNo} is the company seat` })
          continue
        }

        await tx.chitTicket.update({
          where: { id: seat.id },
          data: {
            applicantId: applicant.id,
            routeId: routeIdByCode.get(row.routeCode) ?? null,
            isPrized: row.isPrized,
            status: "active",
          },
        })
        report.seated++
      }

      // 6. The counters the groups list reads, for every group touched.
      for (const groupId of new Set([...groupIdByName.values()])) {
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
    { timeout: 600_000, maxWait: 60_000 }
  )

  console.log("\nDone.")
  console.log(`  routes upserted:   ${report.routes}`)
  console.log(`  employees created: ${report.employees}`)
  console.log(`  groups created:    ${report.groupsCreated.length}${
    report.groupsCreated.length ? ` (${report.groupsCreated.join(", ")})` : ""
  }`)
  console.log(`  applicants:        ${report.applicants}`)
  console.log(`  seats filled:      ${report.seated}`)
  if (report.skipped.length > 0) {
    console.log(`  skipped:           ${report.skipped.length}`)
    for (const s of report.skipped.slice(0, 20)) {
      console.log(`    ${s.row.group}#${s.row.ticketNo} ${s.row.name}: ${s.why}`)
    }
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
