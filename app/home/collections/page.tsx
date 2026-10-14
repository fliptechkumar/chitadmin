"use client"

import { useMemo, useState } from "react"
import { CheckCircle, Plus, Printer, ReceiptText } from "lucide-react"

import Modal from "@/components/admin/modal"
import { Badge, toneFor } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Field, Input, SearchInput, Select } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { StatTile } from "@/components/ui/stat-card"
import {
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table"
import { Toolbar } from "@/components/ui/toolbar"
import { inr, inrCompact, todayDisplay } from "@/lib/format"
import { ALL_GROUPS, COLLECTIONS, type Collection } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const MODES: Collection["mode"][] = ["cash", "online", "cheque"]

function emptyForm() {
  return {
    customerName: "",
    group: "",
    installment: "",
    amount: "",
    mode: "cash" as Collection["mode"],
    date: todayDisplay(),
    collectedBy: "Suresh Kumar",
    penalty: "0",
  }
}

export default function CollectionsPage() {
  const [data, setData] = useState<Collection[]>(COLLECTIONS)
  const [search, setSearch] = useState("")
  const [modeFilter, setModeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRows] = useState(5)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  /** Row that was just settled, highlighted briefly as confirmation. */
  const [flashId, setFlashId] = useState<number | null>(null)

  const hasFilters = Boolean(search || modeFilter || statusFilter)

  function handleClear() {
    setSearch("")
    setModeFilter("")
    setStatusFilter("")
    setPage(1)
  }

  function handleSubmit() {
    if (!form.customerName || !form.amount) return
    const newId = Math.max(0, ...data.map((c) => c.id)) + 1
    setData((d) => [
      ...d,
      {
        id: newId,
        receiptNo: `RCP-2026-${String(newId).padStart(3, "0")}`,
        customerId: 0,
        customerName: form.customerName,
        group: form.group,
        installment: Number(form.installment),
        amount: Number(form.amount),
        mode: form.mode,
        date: form.date,
        collectedBy: form.collectedBy,
        status: "paid",
        penalty: Number(form.penalty),
      },
    ])
    setForm(emptyForm())
    setShowForm(false)
  }

  function markPaid(id: number) {
    setData((d) =>
      d.map((c) => (c.id === id ? { ...c, status: "paid", penalty: 0 } : c))
    )
    setFlashId(id)
    setTimeout(() => setFlashId((current) => (current === id ? null : current)), 1200)
  }

  const filtered = useMemo(
    () =>
      data.filter((c) => {
        const q = search.toLowerCase()
        const matchSearch =
          !q ||
          c.customerName.toLowerCase().includes(q) ||
          c.receiptNo.toLowerCase().includes(q) ||
          c.group.toLowerCase().includes(q)
        return (
          matchSearch &&
          (!modeFilter || c.mode === modeFilter) &&
          (!statusFilter || c.status === statusFilter)
        )
      }),
    [data, search, modeFilter, statusFilter]
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice(
    (safePage - 1) * rowsPerPage,
    safePage * rowsPerPage
  )

  const today = todayDisplay()
  const stats = {
    todayTotal: data
      .filter((c) => c.date === today)
      .reduce((s, c) => s + c.amount, 0),
    totalPaid: data
      .filter((c) => c.status === "paid")
      .reduce((s, c) => s + c.amount, 0),
    totalPending: data
      .filter((c) => c.status === "pending")
      .reduce((s, c) => s + c.amount, 0),
    overdueCount: data.filter((c) => c.status === "overdue").length,
    totalPenalty: data.reduce((s, c) => s + c.penalty, 0),
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile
          index={0}
          label="Today collected"
          value={stats.todayTotal}
          format={inrCompact}
          tone="brand"
        />
        <StatTile
          index={1}
          label="Total paid"
          value={stats.totalPaid}
          format={inrCompact}
          tone="success"
        />
        <StatTile
          index={2}
          label="Pending"
          value={stats.totalPending}
          format={inrCompact}
          tone="warning"
        />
        <StatTile
          index={3}
          label="Overdue count"
          value={stats.overdueCount}
          tone="danger"
        />
        <StatTile
          index={4}
          label="Total penalties"
          value={stats.totalPenalty}
          format={inrCompact}
          tone="danger"
        />
      </div>

      <Toolbar
        showClear={hasFilters}
        onClear={handleClear}
        actions={
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5" />
            New entry
          </Button>
        }
      >
        <SearchInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Search receipt, customer or group…"
          className="min-w-[220px] flex-1"
        />
        <Select
          value={modeFilter}
          onChange={(e) => {
            setModeFilter(e.target.value)
            setPage(1)
          }}
          wrapperClassName="w-36"
          aria-label="Payment mode"
        >
          <option value="">All modes</option>
          {MODES.map((m) => (
            <option key={m} value={m} className="capitalize">
              {m}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          wrapperClassName="w-36"
          aria-label="Status"
        >
          <option value="">All status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
        </Select>
      </Toolbar>

      <Card
        className="reveal overflow-hidden"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        <CardHeader>
          <CardTitle>
            Collection register
            <span className="tnum ml-2 text-xs font-normal text-muted-foreground">
              {filtered.length} records
            </span>
          </CardTitle>
          <Button variant="outline" size="sm">
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
        </CardHeader>

        <TableWrap>
          <Table>
            <THead>
              <tr>
                {[
                  "Receipt no",
                  "Customer",
                  "Group",
                  "Inst.",
                  "Amount",
                  "Penalty",
                  "Mode",
                  "Date",
                  "Collected by",
                  "Status",
                  "",
                ].map((h, i) => (
                  <TH key={`${h}-${i}`}>{h}</TH>
                ))}
              </tr>
            </THead>
            <TBody key={`${safePage}-${filtered.length}`}>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <EmptyState
                      icon={<ReceiptText className="h-5 w-5" />}
                      title="No collections found"
                      description={
                        hasFilters
                          ? "Try relaxing the filters above."
                          : "Record your first receipt to get started."
                      }
                      action={
                        hasFilters ? (
                          <Button variant="outline" size="sm" onClick={handleClear}>
                            Clear filters
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => setShowForm(true)}>
                            <Plus className="h-3.5 w-3.5" />
                            New entry
                          </Button>
                        )
                      }
                    />
                  </td>
                </tr>
              ) : (
                pageRows.map((c, idx) => (
                  <TR
                    key={c.id}
                    index={idx}
                    className={cn(
                      "group transition-colors duration-500",
                      flashId === c.id && "bg-success-soft"
                    )}
                  >
                    <TD className="font-mono text-xs">{c.receiptNo}</TD>
                    <TD className="font-medium text-foreground">{c.customerName}</TD>
                    <TD>{c.group}</TD>
                    <TD className="tnum text-center">{c.installment}</TD>
                    <TD className="tnum font-semibold text-foreground">
                      {inr(c.amount)}
                    </TD>
                    <TD className="tnum">
                      {c.penalty > 0 ? (
                        <span className="font-semibold text-danger-soft-foreground">
                          {inr(c.penalty)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </TD>
                    <TD>
                      <Badge tone={toneFor(c.mode)}>{c.mode}</Badge>
                    </TD>
                    <TD className="tnum whitespace-nowrap">{c.date}</TD>
                    <TD className="whitespace-nowrap">{c.collectedBy}</TD>
                    <TD>
                      <Badge tone={toneFor(c.status)}>{c.status}</Badge>
                    </TD>
                    <TD>
                      <div className="flex items-center gap-1.5">
                        {c.status !== "paid" && (
                          <Button
                            variant="success"
                            size="xs"
                            onClick={() => markPaid(c.id)}
                            title="Mark as paid"
                          >
                            <CheckCircle />
                            Pay
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Print ${c.receiptNo}`}
                          className="opacity-60 transition-opacity group-hover:opacity-100"
                        >
                          <Printer />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </TableWrap>

        <Pagination
          page={safePage}
          totalPages={totalPages}
          totalRows={filtered.length}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          onRowsChange={(r) => {
            setRows(r)
            setPage(1)
          }}
        />
      </Card>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New collection entry"
        description="A receipt number is generated automatically on save."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit}>
              Save &amp; generate receipt
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer name">
            <Input
              value={form.customerName}
              onChange={(e) =>
                setForm((f) => ({ ...f, customerName: e.target.value }))
              }
              placeholder="Rajesh Kumar"
            />
          </Field>
          <Field label="Group">
            <Select
              value={form.group}
              onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
            >
              <option value="">Select group</option>
              {ALL_GROUPS.map((g) => (
                <option key={g.group} value={g.group}>
                  {g.group}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Installment no.">
            <Input
              type="number"
              min={1}
              value={form.installment}
              onChange={(e) =>
                setForm((f) => ({ ...f, installment: e.target.value }))
              }
              placeholder="1"
            />
          </Field>
          <Field label="Amount (₹)">
            <Input
              type="number"
              min={0}
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="5000"
            />
          </Field>
          <Field label="Payment mode">
            <Select
              value={form.mode}
              onChange={(e) =>
                setForm((f) => ({ ...f, mode: e.target.value as Collection["mode"] }))
              }
              className="capitalize"
            >
              {MODES.map((m) => (
                <option key={m} value={m} className="capitalize">
                  {m}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Penalty (₹)">
            <Input
              type="number"
              min={0}
              value={form.penalty}
              onChange={(e) => setForm((f) => ({ ...f, penalty: e.target.value }))}
              placeholder="0"
            />
          </Field>
          <Field label="Collected by" className="sm:col-span-2">
            <Input
              value={form.collectedBy}
              onChange={(e) =>
                setForm((f) => ({ ...f, collectedBy: e.target.value }))
              }
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
