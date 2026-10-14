"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  RotateCcw,
  Trophy,
  Wallet,
} from "lucide-react"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput, Select } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { StatTile } from "@/components/ui/stat-card"
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { Toolbar } from "@/components/ui/toolbar"
import { DUE_STATUS_LABELS, DUE_STATUSES, type DueStatus } from "@/lib/dues"
import { inr, inrCompact } from "@/lib/format"

export type DueRecord = {
  ticketId: number
  ticketNo: number
  accountNo: string
  name: string
  mobile: string
  groupId: number
  group: string
  branch: string
  value: number
  endDate: string
  isPrized: boolean
  installmentNo: number
  dueAmount: number
  paidAmount: number
  status: DueStatus
  pendingCount: number
  outstanding: number
}

export type GroupOption = { id: number; group: string; branchName: string }

const STATUS_TONE: Record<DueStatus, BadgeTone> = {
  paid: "success",
  part_paid: "warning",
  pending: "danger",
  advance: "brand",
}

const STATUS_ICON: Record<DueStatus, React.ReactNode> = {
  paid: <CheckCircle2 className="h-3 w-3" />,
  part_paid: <AlertTriangle className="h-3 w-3" />,
  pending: <Clock className="h-3 w-3" />,
  advance: <Wallet className="h-3 w-3" />,
}

export default function DuesTable({
  branches,
  groups,
}: {
  branches: string[]
  groups: GroupOption[]
}) {
  const [rows, setRows] = useState<DueRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [branch, setBranch] = useState("")
  const [groupId, setGroupId] = useState("")
  const [ticketNo, setTicketNo] = useState("")
  const [status, setStatus] = useState("")
  const [query, setQuery] = useState("")

  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")

    const params = new URLSearchParams()
    if (branch) params.set("branch", branch)
    if (groupId) params.set("groupId", groupId)
    if (ticketNo) params.set("ticketNo", ticketNo)
    if (status) params.set("status", status)
    if (query.trim()) params.set("q", query.trim())

    try {
      const response = await fetch(`/api/dues?${params}`)
      if (!response.ok) throw new Error(String(response.status))
      setRows((await response.json()) as DueRecord[])
    } catch {
      setError("Could not load dues.")
    } finally {
      setLoading(false)
    }
  }, [branch, groupId, ticketNo, status, query])

  // Debounced: the search boxes re-fetch, so typing should not spam the API.
  useEffect(() => {
    const timer = setTimeout(() => {
      void load()
      setPage(1)
    }, 250)
    return () => clearTimeout(timer)
  }, [load])

  // Selecting a branch narrows the group list to that branch's groups.
  const groupOptions = useMemo(
    () => (branch ? groups.filter((g) => g.branchName === branch) : groups),
    [groups, branch]
  )

  const totals = useMemo(
    () => ({
      members: rows.length,
      outstanding: rows.reduce((sum, r) => sum + r.outstanding, 0),
      behind: rows.filter((r) => r.pendingCount > 0).length,
      prized: rows.filter((r) => r.isPrized).length,
    }),
    [rows]
  )

  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const visible = rows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  )

  const hasFilters = Boolean(branch || groupId || ticketNo || status || query)

  function reset() {
    setBranch("")
    setGroupId("")
    setTicketNo("")
    setStatus("")
    setQuery("")
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Members" value={totals.members} index={1} />
        <StatTile label="Behind on dues" value={totals.behind} tone="danger" index={2} />
        <StatTile
          label="Outstanding"
          value={totals.outstanding}
          format={inrCompact}
          tone="warning"
          index={3}
        />
        <StatTile label="Prized" value={totals.prized} tone="brand" index={4} />
      </div>

      <Toolbar
        showClear={hasFilters}
        onClear={reset}
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        }
      >
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, mobile or account no…"
          className="w-full sm:w-64"
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
          {DUE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {DUE_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>

        <SearchInput
          value={ticketNo}
          onChange={(e) => setTicketNo(e.target.value.replace(/\D/g, ""))}
          placeholder="Ticket no"
          className="w-full sm:w-32"
        />
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
            icon={<Wallet className="h-5 w-5" />}
            title={hasFilters ? "No matching members" : "No dues recorded"}
            description={
              hasFilters
                ? "Try a different branch, group or status."
                : "Dues appear once members are seated on a chit group."
            }
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH className="w-14">Ticket</TH>
                    <TH>Member</TH>
                    <TH>Group</TH>
                    <TH className="text-right">Value</TH>
                    <TH className="text-right">Due</TH>
                    <TH>Status</TH>
                    <TH>Pending</TH>
                    <TH>Prized</TH>
                    <TH>Ends</TH>
                    <TH className="text-right">Actions</TH>
                  </tr>
                </THead>
                <TBody key={`${currentPage}-${branch}-${groupId}-${status}-${query}-${ticketNo}`}>
                  {visible.map((row, index) => (
                    <TR key={row.ticketId} index={index}>
                      <TD className="tnum font-medium text-foreground">{row.ticketNo}</TD>

                      <TD>
                        <p className="truncate font-medium text-foreground">{row.name}</p>
                        <p className="tnum truncate text-xs text-muted-foreground">
                          {row.accountNo} · {row.mobile}
                        </p>
                      </TD>

                      <TD className="whitespace-nowrap text-xs">
                        {row.group}
                        <span className="block text-muted-foreground">{row.branch}</span>
                      </TD>

                      <TD className="tnum whitespace-nowrap text-right">
                        {inr(row.value)}
                      </TD>

                      <TD className="whitespace-nowrap text-right">
                        <span className="tnum block font-medium text-foreground">
                          {inr(row.dueAmount)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          instalment {row.installmentNo}
                        </span>
                      </TD>

                      <TD>
                        <Badge tone={STATUS_TONE[row.status]}>
                          {STATUS_ICON[row.status]}
                          {DUE_STATUS_LABELS[row.status]}
                        </Badge>
                      </TD>

                      <TD>
                        {row.pendingCount === 0 ? (
                          <span className="text-xs text-muted-foreground">None</span>
                        ) : (
                          <span className="flex flex-col gap-0.5">
                            <Badge tone="danger">
                              <AlertTriangle className="h-3 w-3" />
                              {row.pendingCount} unpaid
                            </Badge>
                            <span className="tnum text-xs text-muted-foreground">
                              {inr(row.outstanding)} owed
                            </span>
                          </span>
                        )}
                      </TD>

                      <TD>
                        {row.isPrized ? (
                          <Badge tone="violet">
                            <Trophy className="h-3 w-3" />
                            Prized
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">No</span>
                        )}
                      </TD>

                      <TD className="tnum whitespace-nowrap text-xs">{row.endDate}</TD>

                      <TD>
                        <div className="flex justify-end">
                          <Button variant="ghost" size="icon-sm" asChild>
                            <Link
                              href={`/home/dues/${row.ticketId}`}
                              aria-label={`View dues for ${row.name}`}
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
