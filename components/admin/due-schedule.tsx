"use client"

import { useMemo, useState } from "react"
import { ArrowDownUp, CalendarClock, CheckCircle2, Clock, Wallet } from "lucide-react"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { inr } from "@/lib/format"
import { cn } from "@/lib/utils"

export type ScheduleRow = {
  installmentNo: number
  dueDate: string
  paidOn: string | null
  amountDue: number
  amountPaid: number
  prizeAmount: number
  dividend: number
}

/** Statement-level state, which adds "not started" for months not yet due. */
type RowState = "paid" | "part_paid" | "pending" | "not_started" | "advance"

const STATE_META: Record<RowState, { label: string; tone: BadgeTone }> = {
  paid: { label: "Paid", tone: "success" },
  advance: { label: "Advance", tone: "brand" },
  part_paid: { label: "Part paid", tone: "warning" },
  pending: { label: "Pending", tone: "danger" },
  not_started: { label: "Not started", tone: "neutral" },
}

function stateFor(row: ScheduleRow, today: Date): RowState {
  const future = new Date(row.dueDate) > today

  if (row.amountPaid <= 0) return future ? "not_started" : "pending"
  if (row.amountPaid < row.amountDue) return "part_paid"
  // Money in before the month fell due.
  return future ? "advance" : "paid"
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function DueSchedule({ rows }: { rows: ScheduleRow[] }) {
  const [unpaidOnly, setUnpaidOnly] = useState(false)
  const [hideFuture, setHideFuture] = useState(false)
  const [ascending, setAscending] = useState(true)

  // Fixed per render so every row is judged against the same moment.
  const today = useMemo(() => new Date(), [])

  const visible = useMemo(() => {
    const withState = rows.map((row) => ({ row, state: stateFor(row, today) }))

    const filtered = withState.filter(({ row }) => {
      if (unpaidOnly && row.amountPaid >= row.amountDue) return false
      if (hideFuture && new Date(row.dueDate) > today) return false
      return true
    })

    return filtered.sort((a, b) =>
      ascending
        ? a.row.installmentNo - b.row.installmentNo
        : b.row.installmentNo - a.row.installmentNo
    )
  }, [rows, unpaidOnly, hideFuture, ascending, today])

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <Button
          variant={unpaidOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setUnpaidOnly((v) => !v)}
          aria-pressed={unpaidOnly}
        >
          <Clock className="h-3.5 w-3.5" />
          Unpaid only
        </Button>
        <Button
          variant={hideFuture ? "default" : "outline"}
          size="sm"
          onClick={() => setHideFuture((v) => !v)}
          aria-pressed={hideFuture}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Hide future dues
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAscending((v) => !v)}
          className="ml-auto"
        >
          <ArrowDownUp className="h-3.5 w-3.5" />
          {ascending ? "Oldest first" : "Newest first"}
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-5 w-5" />}
          title="Nothing to show"
          description="Every instalment is settled, or the filters above hide them all."
        />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH className="w-16">Due no</TH>
                <TH className="text-right">Prize amount</TH>
                <TH className="text-right">Dividend</TH>
                <TH className="text-right">Due amount</TH>
                <TH>Due date</TH>
                <TH>Paid on</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <TBody key={`${unpaidOnly}-${hideFuture}-${ascending}`}>
              {visible.map(({ row, state }, index) => {
                const short = Math.max(0, row.amountDue - row.amountPaid)

                return (
                  <TR key={row.installmentNo} index={index}>
                    <TD className="tnum font-medium text-foreground">
                      {row.installmentNo}
                    </TD>
                    <TD className="tnum whitespace-nowrap text-right">
                      {inr(row.prizeAmount)}
                    </TD>
                    <TD className="tnum whitespace-nowrap text-right text-success-soft-foreground">
                      −{inr(row.dividend)}
                    </TD>
                    <TD className="tnum whitespace-nowrap text-right font-medium text-foreground">
                      {inr(row.amountDue)}
                      {state === "part_paid" && (
                        <span className="block text-xs font-normal text-warning-soft-foreground">
                          {inr(short)} short
                        </span>
                      )}
                    </TD>
                    <TD
                      className={cn(
                        "tnum whitespace-nowrap text-xs",
                        state === "pending" && "font-medium text-danger"
                      )}
                    >
                      {formatDate(row.dueDate)}
                    </TD>
                    <TD className="tnum whitespace-nowrap text-xs">
                      {formatDate(row.paidOn)}
                    </TD>
                    <TD>
                      <Badge tone={STATE_META[state].tone}>
                        {state === "paid" && <CheckCircle2 className="h-3 w-3" />}
                        {STATE_META[state].label}
                      </Badge>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </Card>
  )
}
