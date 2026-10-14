"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarDays, Clock, Eye, Gavel, Users } from "lucide-react"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Input, Select } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { StatTile } from "@/components/ui/stat-card"
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { Toolbar } from "@/components/ui/toolbar"
import { formatDay, inr, inrCompact } from "@/lib/format"

export type AuctionRecord = {
  id: number
  branch: string
  groupId: number
  group: string
  groupStartDate: string
  groupValue: number
  totalTickets: number
  installmentNo: number
  auctionDate: string
  /** Server-local calendar day; see the note in the API route. */
  auctionDay: string
  auctionTime: string
  prizedCount: number
  prizeAmount: number
  discount: number
  dividend: number
  status: "scheduled" | "completed" | "cancelled"
  winner: { ticketNo: number; code: string; name: string; mobile: string } | null
}

export type GroupOption = { id: number; group: string; branchName: string }

const STATUS_TONE: Record<AuctionRecord["status"], BadgeTone> = {
  completed: "success",
  scheduled: "brand",
  cancelled: "neutral",
}

/** Today in the yyyy-mm-dd shape a date input expects. */
function todayInput() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`
}

export default function AuctionsTable({
  branches,
  groups,
}: {
  branches: string[]
  groups: GroupOption[]
}) {
  const [rows, setRows] = useState<AuctionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [date, setDate] = useState("")
  const [branch, setBranch] = useState("")
  const [groupId, setGroupId] = useState("")
  const [status, setStatus] = useState("")

  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")

    const params = new URLSearchParams()
    if (date) params.set("date", date)
    if (branch) params.set("branch", branch)
    if (groupId) params.set("groupId", groupId)
    if (status) params.set("status", status)

    try {
      const response = await fetch(`/api/auctions?${params}`)
      if (!response.ok) throw new Error(String(response.status))
      setRows((await response.json()) as AuctionRecord[])
    } catch {
      setError("Could not load auctions.")
    } finally {
      setLoading(false)
    }
  }, [date, branch, groupId, status])

  useEffect(() => {
    void load()
    setPage(1)
  }, [load])

  const groupOptions = useMemo(
    () => (branch ? groups.filter((g) => g.branchName === branch) : groups),
    [groups, branch]
  )

  const totals = useMemo(
    () => ({
      rounds: rows.length,
      upcoming: rows.filter((r) => r.status === "scheduled").length,
      prized: rows.reduce((sum, r) => sum + (r.status === "completed" ? r.prizeAmount : 0), 0),
      discount: rows.reduce((sum, r) => sum + r.discount, 0),
    }),
    [rows]
  )

  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const visible = rows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  const hasFilters = Boolean(date || branch || groupId || status)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Rounds" value={totals.rounds} index={1} />
        <StatTile label="Upcoming" value={totals.upcoming} tone="brand" index={2} />
        <StatTile
          label="Prized"
          value={totals.prized}
          format={inrCompact}
          tone="success"
          index={3}
        />
        <StatTile
          label="Discount given"
          value={totals.discount}
          format={inrCompact}
          tone="warning"
          index={4}
        />
      </div>

      <Toolbar
        showClear={hasFilters}
        onClear={() => {
          setDate("")
          setBranch("")
          setGroupId("")
          setStatus("")
        }}
        actions={
          <Button variant="outline" onClick={() => setDate(todayInput())}>
            <CalendarDays className="h-4 w-4" />
            Today
          </Button>
        }
      >
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full sm:w-44"
          aria-label="Auction date"
        />

        {branches.length > 1 && (
          <Select
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value)
              setGroupId("")
            }}
            wrapperClassName="w-full sm:w-40"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        )}

        <Select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          wrapperClassName="w-full sm:w-40"
        >
          <option value="">All groups</option>
          {groupOptions.map((g) => (
            <option key={g.id} value={g.id}>
              {g.group}
            </option>
          ))}
        </Select>

        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          wrapperClassName="w-full sm:w-36"
        >
          <option value="">All statuses</option>
          <option value="completed">Held</option>
          <option value="scheduled">Scheduled</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </Toolbar>

      {error && (
        <p className="animate-scale-in rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-soft-foreground">
          {error}
        </p>
      )}

      <Card className="overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Gavel className="h-5 w-5" />}
            title={hasFilters ? "No auctions match" : "No auctions scheduled"}
            description={
              hasFilters
                ? "Try another date, branch or group."
                : "Auction rounds appear once groups are running."
            }
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>Date</TH>
                    <TH>Group</TH>
                    <TH className="text-right">Due no</TH>
                    <TH className="text-right">Group value</TH>
                    <TH>Winner</TH>
                    <TH className="text-right">Prize</TH>
                    <TH>Prized</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </tr>
                </THead>
                <TBody key={`${currentPage}-${date}-${branch}-${groupId}-${status}`}>
                  {visible.map((row, index) => (
                    <TR key={row.id} index={index}>
                      <TD className="whitespace-nowrap">
                        <span className="tnum block text-foreground">
                          {formatDay(row.auctionDay)}
                        </span>
                        <span className="tnum flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {row.auctionTime}
                        </span>
                      </TD>

                      <TD className="whitespace-nowrap">
                        <span className="block font-medium text-foreground">
                          {row.group}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {row.branch}
                        </span>
                      </TD>

                      <TD className="tnum text-right">{row.installmentNo}</TD>

                      <TD className="tnum whitespace-nowrap text-right">
                        {inr(row.groupValue)}
                      </TD>

                      <TD>
                        {row.winner ? (
                          <>
                            <span className="block truncate font-medium text-foreground">
                              {row.winner.name}
                            </span>
                            <span className="tnum block truncate text-xs text-muted-foreground">
                              Ticket {row.winner.ticketNo} · {row.winner.code}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Not yet held
                          </span>
                        )}
                      </TD>

                      <TD className="whitespace-nowrap text-right">
                        {row.status === "completed" ? (
                          <>
                            <span className="tnum block font-medium text-foreground">
                              {inr(row.prizeAmount)}
                            </span>
                            <span className="tnum block text-xs text-success-soft-foreground">
                              −{inr(row.discount)} bid
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TD>

                      <TD>
                        <span className="tnum flex items-center gap-1 text-xs">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          {row.prizedCount}/{row.totalTickets}
                        </span>
                      </TD>

                      <TD>
                        <Badge tone={STATUS_TONE[row.status]} dot>
                          {row.status === "completed" ? "held" : row.status}
                        </Badge>
                      </TD>

                      {/* The round opens as a page rather than a dialog: the
                          auction hall is worked in, not glanced at. */}
                      <TD>
                        <div className="flex justify-end">
                          <Button variant="ghost" size="icon-sm" asChild>
                            <Link
                              href={`/home/auctions/${row.id}`}
                              aria-label={`Open ${row.group} due ${row.installmentNo}`}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            <Pagination
              page={currentPage}
              totalPages={totalPages}
              totalRows={rows.length}
              rowsPerPage={rowsPerPage}
              onPageChange={setPage}
              onRowsChange={(next) => {
                setRowsPerPage(next)
                setPage(1)
              }}
            />
          </>
        )}
      </Card>
    </div>
  )
}
