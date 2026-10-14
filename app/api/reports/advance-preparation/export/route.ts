import ExcelJS from "exceljs"
import { NextResponse } from "next/server"

import { authorizeApi } from "@/lib/auth-server"
import { getCompany } from "@/lib/company"
import { buildAdvanceReport, parseAdvanceQuery } from "@/lib/advance-preparation-report"
import {
  COLLECTION_TYPES,
  PAY_STATUSES,
  PAY_STATUS_LABELS,
  PRIZE_FILTERS,
  filterRows,
  formatPeriod,
  summarise,
  type AdvanceFilters,
} from "@/lib/advance-preparation"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const
const RUPEE = '"₹"#,##,##0'

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | "" {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : ""
}

/**
 * GET /api/reports/advance-preparation/export
 *
 * The on-screen sheet as a workbook, with the same filters applied: the
 * route's subscribers in collection order, ready to print or hand out.
 */
export async function GET(request: Request) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const parsed = parseAdvanceQuery(url)
  if (!parsed.ok) return parsed.response

  const filters: AdvanceFilters = {
    prize: pick(url.searchParams.get("prize"), PRIZE_FILTERS.filter(Boolean)),
    type: pick(url.searchParams.get("type"), COLLECTION_TYPES),
    status: pick(url.searchParams.get("status"), PAY_STATUSES),
    q: url.searchParams.get("q") ?? "",
  }

  const [report, company] = await Promise.all([
    buildAdvanceReport(auth.user, parsed.query),
    getCompany(),
  ])
  const rows = filterRows(report.rows, filters)
  const s = summarise(rows)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = company.name
  const sheet = workbook.addWorksheet("Collection Sheet", {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })

  const routeLabel =
    parsed.query.route && rows[0] ? rows[0].routeCode : parsed.query.route ? "—" : "All routes"

  sheet.addRow([company.name]).font = { bold: true, size: 14 }
  sheet.addRow(["Route Collection Sheet"]).font = { bold: true, size: 12 }
  sheet.addRow([
    `Period: ${formatPeriod(report.from, report.to)}`,
    "",
    "",
    `Branch: ${parsed.query.branch ?? "All branches"}`,
    "",
    `Route: ${routeLabel}`,
  ])
  sheet.addRow([
    `Subscribers: ${s.subscribers}`,
    "",
    "",
    `Due: ₹${s.due.toLocaleString("en-IN")}`,
    "",
    `Collected: ₹${s.paid.toLocaleString("en-IN")}`,
    "",
    `Efficiency: ${s.efficiency.toFixed(1)}%`,
  ])
  sheet.addRow([])

  const header = sheet.addRow([
    "S.No",
    "Branch",
    "Route",
    "Account No",
    "Due Date",
    "Name",
    "Mobile",
    "Area",
    "Group",
    "Ticket",
    "Chit Value",
    "Inst. No",
    "Due",
    "Paid",
    "Balance",
    "Arrears (count)",
    "Arrears",
    "Status",
    "Prized",
    "Staff",
  ])
  header.font = { bold: true }
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } }

  rows.forEach((r, i) => {
    sheet.addRow([
      i + 1,
      r.branch,
      r.routeCode,
      r.accountNo,
      r.dueDate ?? "",
      r.name,
      r.mobile,
      r.area,
      r.group,
      r.ticketNo,
      r.chitValue,
      r.installmentNo ?? "",
      r.due,
      r.paid,
      Math.max(0, r.due - r.paid),
      r.arrearsCount ?? "",
      r.arrearsAmount ?? "",
      PAY_STATUS_LABELS[r.status],
      r.isPrized ? "Prized" : "",
      r.staff,
    ])
  })

  const total = sheet.addRow([
    "",
    "Total",
    ...Array(10).fill(""),
    s.due,
    rows.reduce((sum, r) => sum + r.paid, 0),
    s.balance,
    "",
    s.arrears,
  ])
  total.font = { bold: true }
  total.border = { top: { style: "thin" } }

  const widths = [6, 12, 9, 14, 11, 24, 13, 18, 10, 7, 12, 8, 11, 11, 11, 9, 11, 10, 8, 20]
  widths.forEach((w, i) => (sheet.getColumn(i + 1).width = w))
  for (const col of [11, 13, 14, 15, 17]) sheet.getColumn(col).numFmt = RUPEE

  const buffer = await workbook.xlsx.writeBuffer()
  const suffix = [report.from, report.to, routeLabel].join("_").replace(/[^\w-]+/g, "-")

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="collection_sheet_${suffix}.xlsx"`,
      "Cache-Control": "no-store",
    },
  })
}
