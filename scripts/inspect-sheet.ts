/**
 * Dumps the raw shape of member spreadsheets so their columns can be mapped
 * before anything is imported. Reads nothing from the database and writes
 * nothing anywhere — it only prints.
 *
 * Header rows in hand-kept registers rarely sit on row 1 (there is usually a
 * group name, a chit value, a branch banner above them), so this prints the
 * first rows verbatim, cell by cell, rather than guessing which row is the
 * header and hiding everything above it.
 *
 * Usage:
 *   npx tsx scripts/inspect-sheet.ts data/members             # every sheet in the folder
 *   npx tsx scripts/inspect-sheet.ts data/members/group-a.xlsx
 *   npx tsx scripts/inspect-sheet.ts data/members --rows 25   # look deeper
 */
import ExcelJS from "exceljs"
import { readdir, stat } from "node:fs/promises"
import { join, extname } from "node:path"

/** Rows printed per sheet unless --rows says otherwise. */
const DEFAULT_ROWS = 12
/** Cell text longer than this is clipped, to keep one row on one line. */
const MAX_CELL = 28

/** Every .xlsx under `target`, or just `target` when it is itself a file. */
async function workbookPaths(target: string): Promise<string[]> {
  const info = await stat(target)
  if (!info.isDirectory()) return [target]

  const entries = await readdir(target)
  return entries
    .filter((name) => !name.startsWith("~$") && extname(name).toLowerCase() === ".xlsx")
    .sort()
    .map((name) => join(target, name))
}

/**
 * A cell as text. ExcelJS hands back dates, formula results and rich text as
 * objects, and each has to be unwrapped or the dump reads "[object Object]".
 */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ""
  // Read off the local parts, not toISOString: a date cell arrives as local
  // midnight, and in any positive-offset timezone (IST included) the UTC form
  // of that is the previous day.
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  }
  if (typeof value === "object") {
    if ("text" in value) return String(value.text)
    if ("result" in value) return String(value.result ?? "")
    if ("richText" in value) return value.richText.map((part) => part.text).join("")
    // A hyperlink cell normally carries its own text, caught by the branch
    // above; this is the bare-link case.
    if ("hyperlink" in value) return String(value.hyperlink)
    return JSON.stringify(value)
  }
  return String(value)
}

function clip(text: string) {
  const flat = text.replace(/\s+/g, " ").trim()
  return flat.length > MAX_CELL ? `${flat.slice(0, MAX_CELL - 1)}…` : flat
}

/** Spreadsheet column letters, so a mapping can be written against them. */
function columnLetter(index: number) {
  let letter = ""
  let n = index
  while (n > 0) {
    const remainder = (n - 1) % 26
    letter = String.fromCharCode(65 + remainder) + letter
    n = Math.floor((n - 1) / 26)
  }
  return letter
}

async function inspect(path: string, rowLimit: number) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(path)

  console.log(`\n${"=".repeat(72)}`)
  console.log(`FILE  ${path}`)
  console.log(`      ${workbook.worksheets.length} sheet(s)`)

  for (const sheet of workbook.worksheets) {
    // rowCount counts trailing formatted-but-empty rows too, so it is a ceiling
    // on the member count, not the member count itself.
    console.log(`\n  SHEET "${sheet.name}" — ${sheet.rowCount} rows x ${sheet.columnCount} cols`)

    const width = Math.min(sheet.columnCount, 15)
    const header = Array.from({ length: width }, (_, i) => columnLetter(i + 1).padEnd(MAX_CELL))
    console.log(`    ${"#".padStart(3)} | ${header.join("| ")}`)

    for (let r = 1; r <= Math.min(sheet.rowCount, rowLimit); r++) {
      const row = sheet.getRow(r)
      const cells = Array.from({ length: width }, (_, i) =>
        clip(cellText(row.getCell(i + 1).value)).padEnd(MAX_CELL)
      )
      // A blank row usually separates a banner from the real header; keeping it
      // in the dump is what makes that boundary visible.
      console.log(`    ${String(r).padStart(3)} | ${cells.join("| ")}`)
    }

    if (sheet.rowCount > rowLimit) {
      console.log(`    ... ${sheet.rowCount - rowLimit} more rows`)
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const rowsFlag = args.indexOf("--rows")
  const rowLimit = rowsFlag === -1 ? DEFAULT_ROWS : Number(args[rowsFlag + 1]) || DEFAULT_ROWS
  const target = args.find((arg, i) => !arg.startsWith("--") && args[i - 1] !== "--rows")

  if (!target) {
    throw new Error("Pass a .xlsx file or a folder of them, e.g. data/members")
  }

  const paths = await workbookPaths(target)
  if (paths.length === 0) throw new Error(`No .xlsx files found in ${target}`)

  for (const path of paths) await inspect(path, rowLimit)
  console.log(`\nInspected ${paths.length} file(s). Nothing was written.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
