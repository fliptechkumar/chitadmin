/**
 * Reads the branch's Advance Preparation sheets — one spreadsheet per
 * collection route — into seat rows. Shared by the Settings upload and
 * scripts/import-members.ts, so both agree on the layout and refuse a sheet
 * whose columns have moved.
 *
 * Each row is one *seat*, not one person: a subscriber holding two tickets
 * appears twice, under two account numbers. The account number is therefore
 * what a member is keyed on.
 *
 * Deliberately free of server-only and "@/" imports so the tsx script can load
 * it too.
 */
import ExcelJS from "exceljs"

/** The header sits on row 6 under a four-line banner; data starts below it. */
export const HEADER_ROW = 6
export const FIRST_DATA_ROW = 7

/** Columns, 1-based, as the Advance Preparation export lays them out. */
export const COL = {
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
export const EXPECTED_HEADERS: Record<number, string> = {
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

export type SheetRow = {
  file: string
  /** Spreadsheet row number, so problems can be pointed at in the sheet. */
  rowNo: number
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
export function cellText(value: ExcelJS.CellValue): string {
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
 * Sheets shout their text; the register displays it as written elsewhere.
 * Short all-capital tokens are left alone — a route named "PTM" is an
 * abbreviation, and "Ptm" would be a misspelling of it rather than a tidier
 * one.
 */
export function titleCase(text: string) {
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
 * "R01-KODUMBALUR" -> code R01, name Kodumbalur. The office round carries no
 * number; it keeps OFFICE as its code so it still sorts and reads as a route.
 */
export function parseRoute(banner: string): { code: string; name: string } {
  const raw = banner.replace(/^Route:\s*/i, "").trim()
  const match = /^(R\d+)-(.+)$/.exec(raw)
  if (!match) return { code: raw.toUpperCase(), name: titleCase(raw) }
  return { code: match[1].toUpperCase(), name: titleCase(match[2]) }
}

/**
 * Splits a written name into the register's two fields. Names here are given
 * name followed by an initial ("SARAVANAN N"), so the last token is the
 * surname and everything before it the given name. A single-token name keeps
 * an empty surname rather than borrowing one.
 */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: "", lastName: "" }
  if (parts.length === 1) return { firstName: parts[0], lastName: "" }
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] }
}

/**
 * The seat rows of one workbook. Throws, naming the file, when the layout is
 * not the one COL describes — a shifted column would otherwise silently seat
 * people on the wrong tickets.
 */
export async function parseMemberWorkbook(
  file: string,
  data: ArrayBuffer | Buffer
): Promise<SheetRow[]> {
  const workbook = new ExcelJS.Workbook()
  try {
    // ExcelJS's Buffer typing predates Node's generic Buffer; both shapes load.
    await workbook.xlsx.load(data as ArrayBuffer)
  } catch {
    throw new Error(`${file}: not a readable .xlsx file`)
  }
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error(`${file}: no sheets`)

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

  const rows: SheetRow[] = []
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
      rowNo: r,
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

  return rows
}

/**
 * Problems that make a set of rows unsafe to apply in any order: two rows on
 * one seat, or one account number on two rows. Empty when the rows are clean.
 */
export function findConflicts(rows: SheetRow[]): string[] {
  const problems: string[] = []

  const bySeat = new Map<string, SheetRow>()
  for (const row of rows) {
    const key = `${row.group}#${row.ticketNo}`
    const seen = bySeat.get(key)
    if (seen) {
      problems.push(
        `Seat ${key} is claimed by ${seen.accountNo} (${seen.file}) and ${row.accountNo} (${row.file})`
      )
    } else bySeat.set(key, row)
  }

  const byAccount = new Map<string, SheetRow>()
  for (const row of rows) {
    const seen = byAccount.get(row.accountNo)
    if (seen) {
      problems.push(
        `Account ${row.accountNo} appears twice: ${seen.file} row ${seen.rowNo} and ${row.file} row ${row.rowNo}`
      )
    } else byAccount.set(row.accountNo, row)
  }

  return problems
}
