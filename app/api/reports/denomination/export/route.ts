import ExcelJS from "exceljs"
import { NextResponse } from "next/server"

import { authorizeApi } from "@/lib/auth-server"
import { getCompany } from "@/lib/company"
import { buildDenominationReport } from "@/lib/denomination-report"
import {
  DENOMINATIONS,
  isIsoDay,
  isoToDisplay,
  varianceOf,
} from "@/lib/denomination"

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIT_ADMIN"] as const

const RUPEE = '"₹"#,##,##0'
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFEEF2FF" },
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true }
  row.fill = HEADER_FILL
  row.alignment = { vertical: "middle" }
  row.height = 20
}

function styleTotal(row: ExcelJS.Row) {
  row.font = { bold: true }
  row.border = { top: { style: "thin" } }
}

/**
 * GET /api/reports/denomination/export?date=&branch=&route=
 *
 * The same report as the screen, as a workbook: a summary, the route
 * reconciliation, every receipt, and the note-by-note cash count.
 */
export async function GET(request: Request) {
  const auth = await authorizeApi(ADMIN_ROLES)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const date = url.searchParams.get("date")
  if (!isIsoDay(date)) {
    return NextResponse.json({ error: "Pick a collection date." }, { status: 400 })
  }

  const branch = url.searchParams.get("branch")?.trim() || undefined
  const route = url.searchParams.get("route")?.trim() || undefined

  const [report, company] = await Promise.all([
    buildDenominationReport(auth.user, { date, branch, route }),
    getCompany(),
  ])

  const workbook = new ExcelJS.Workbook()
  workbook.creator = company.name
  workbook.created = new Date()

  // --- Summary --------------------------------------------------------------
  const cash = report.routes.reduce((s, r) => s + r.cash, 0)
  const online = report.routes.reduce((s, r) => s + r.online, 0)
  const cheque = report.routes.reduce((s, r) => s + r.cheque, 0)
  const counted = report.routes.reduce((s, r) => s + (r.tally?.total ?? 0), 0)
  const countedCash = report.routes
    .filter((r) => r.tally)
    .reduce((s, r) => s + r.cash, 0)

  const summary = workbook.addWorksheet("Summary")
  summary.columns = [{ width: 28 }, { width: 22 }, { width: 12 }]
  summary.addRow([company.name]).font = { bold: true, size: 14 }
  summary.addRow(["Denomination Report"]).font = { bold: true, size: 12 }
  summary.addRow([])
  summary.addRow(["Collection date", isoToDisplay(date)])
  summary.addRow(["Branch", branch ?? "All branches"])
  summary.addRow([
    "Route",
    route
      ? (report.routes[0] ? `${report.routes[0].code} · ${report.routes[0].name}` : route)
      : "All routes",
  ])
  summary.addRow(["Generated", new Date().toLocaleString("en-IN")])
  summary.addRow([])
  styleHeader(summary.addRow(["Payment mode", "Amount", "Receipts"]))
  for (const [label, amount, mode] of [
    ["Cash", cash, "cash"],
    ["Online", online, "online"],
    ["Cheque", cheque, "cheque"],
  ] as const) {
    summary.addRow([label, amount, report.rows.filter((r) => r.mode === mode).length])
  }
  styleTotal(summary.addRow(["Total collection", cash + online + cheque, report.rows.length]))
  summary.addRow([])
  summary.addRow(["Cash counted", counted])
  summary.addRow(["Variance (counted routes)", counted - countedCash])
  summary.getColumn(2).numFmt = RUPEE

  // --- Routes ---------------------------------------------------------------
  const routes = workbook.addWorksheet("Routes")
  routes.columns = [
    { header: "Branch", width: 16 },
    { header: "Route", width: 10 },
    { header: "Name", width: 24 },
    { header: "Executives", width: 28 },
    { header: "Receipts", width: 10 },
    { header: "Cash", width: 14, style: { numFmt: RUPEE } },
    { header: "Online", width: 14, style: { numFmt: RUPEE } },
    { header: "Cheque", width: 14, style: { numFmt: RUPEE } },
    { header: "Total", width: 14, style: { numFmt: RUPEE } },
    { header: "Cash counted", width: 14, style: { numFmt: RUPEE } },
    { header: "Variance", width: 14, style: { numFmt: RUPEE } },
    { header: "Counted by", width: 18 },
    { header: "Remarks", width: 30 },
  ]
  styleHeader(routes.getRow(1))
  for (const r of report.routes) {
    routes.addRow([
      r.branch,
      r.code,
      r.name,
      r.executives.join(", "),
      r.receipts,
      r.cash,
      r.online,
      r.cheque,
      r.total,
      r.tally?.total ?? "Not counted",
      varianceOf(r) ?? "",
      r.tally?.countedBy ?? "",
      r.tally?.remarks ?? "",
    ])
  }
  styleTotal(
    routes.addRow([
      "Total",
      "",
      "",
      "",
      report.rows.length,
      cash,
      online,
      cheque,
      cash + online + cheque,
      counted,
      counted - countedCash,
    ])
  )

  // --- Collections ----------------------------------------------------------
  const routeLabel = new Map(report.routes.map((r) => [r.key, r.code]))
  const receipts = workbook.addWorksheet("Collections")
  receipts.columns = [
    { header: "S.No", width: 6 },
    { header: "Receipt no", width: 16 },
    { header: "Time", width: 10 },
    { header: "Member", width: 24 },
    { header: "Group", width: 12 },
    { header: "Inst.", width: 6 },
    { header: "Branch", width: 14 },
    { header: "Route", width: 10 },
    { header: "Collected by", width: 18 },
    { header: "Mode", width: 10 },
    { header: "Amount", width: 12, style: { numFmt: RUPEE } },
    { header: "Penalty", width: 12, style: { numFmt: RUPEE } },
    { header: "Total", width: 12, style: { numFmt: RUPEE } },
  ]
  styleHeader(receipts.getRow(1))
  report.rows.forEach((r, i) => {
    receipts.addRow([
      i + 1,
      r.receiptNo,
      new Date(r.createdAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      }),
      r.customerName,
      r.group,
      r.installment,
      r.branch,
      routeLabel.get(`${r.branch}|${r.routeId ?? "-"}`) ?? "—",
      r.collectedBy,
      r.mode.toUpperCase(),
      r.amount,
      r.penalty,
      r.total,
    ])
  })
  styleTotal(
    receipts.addRow([
      "",
      "Total",
      ...Array(8).fill(""),
      report.rows.reduce((s, r) => s + r.amount, 0),
      report.rows.reduce((s, r) => s + r.penalty, 0),
      cash + online + cheque,
    ])
  )

  // --- Cash count -----------------------------------------------------------
  const tallied = report.routes.filter((r) => r.tally)
  const count = workbook.addWorksheet("Cash count")
  count.columns = [
    { header: "Denomination", width: 14 },
    ...tallied.map((r) => ({ header: `${r.code} ${r.branch}`, width: 14 })),
    { header: "Total pieces", width: 12 },
    { header: "Amount", width: 14, style: { numFmt: RUPEE } },
  ]
  styleHeader(count.getRow(1))
  for (const value of DENOMINATIONS) {
    const pieces = tallied.map((r) => r.tally?.counts[`${value}`] ?? 0)
    const sum = pieces.reduce((s, n) => s + n, 0)
    count.addRow([`₹${value}`, ...pieces, sum, sum * value])
  }
  styleTotal(
    count.addRow([
      "Total (₹)",
      ...tallied.map((r) => r.tally?.total ?? 0),
      "",
      counted,
    ])
  )

  const buffer = await workbook.xlsx.writeBuffer()
  const suffix = [date, branch, route].filter(Boolean).join("_").replace(/[^\w-]+/g, "-")

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="denomination_${suffix}.xlsx"`,
      "Cache-Control": "no-store",
    },
  })
}
