"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw, Trophy } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Combobox } from "@/components/ui/combobox"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput, Select } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { StatTile } from "@/components/ui/stat-card"
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { Toolbar } from "@/components/ui/toolbar"
import type { PrizedRecord } from "@/lib/auction-types"
import { formatDay, inr, inrCompact } from "@/lib/format"
import type { GroupOption } from "./auctions-table"

const FILTER_WIDTH = "w-full sm:w-auto sm:min-w-40 sm:flex-1"

/** "Nov 2025" from a yyyy-mm-dd day. */
function monthYear(day: string) {
  const [y, m] = day.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
}

/**
 * Every prized seat, listed group by group. The whole list is fetched once and
 * filtered here: it is a few thousand rows at most, and filters then answer
 * instantly as the office types.
 */
export default function PrizedMembers({
  branches,
  groups,
}: {
  branches: string[]
  groups: GroupOption[]
}) {
  const [rows, setRows] = useState<PrizedRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [q, setQ] = useState("")
  const [branch, setBranch] = useState("")
  const [groupId, setGroupId] = useState("")
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/auctions/prized")
      if (!response.ok) throw new Error()
      setRows(await response.json())
    } catch {
      setError("Could not load prized members. Try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const groupChoices = useMemo(
    () => [
      { value: "", label: "All groups" },
      ...groups
        .filter((g) => !branch || g.branchName === branch)
        .map((g) => ({ value: String(g.id), label: g.group, group: g.branchName })),
    ],
    [groups, branch]
  )

  // Prized seats per group across the whole register, so a group's header
  // reads "17 of 20" even when a search narrows the rows below it.
  const perGroup = useMemo(() => {
    const map = new Map<number, number>()
    for (const r of rows) map.set(r.groupId, (map.get(r.groupId) ?? 0) + 1)
    return map
  }, [rows])

  const filtered = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return rows.filter((r) => {
      if (branch && r.branch !== branch) return false
      if (groupId && String(r.groupId) !== groupId) return false
      if (!words.length) return true
      const hay = `${r.name} ${r.code} ${r.mobile} ${r.group} ${r.ticketNo}`.toLowerCase()
      return words.every((w) => hay.includes(w))
    })
  }, [rows, q, branch, groupId])

  const totals = useMemo(() => {
    const groupIds = new Set(filtered.map((r) => r.groupId))
    return {
      members: filtered.length,
      groups: groupIds.size,
      viaAuction: filtered.filter((r) => r.viaAuction).length,
      prizeAmount: filtered.reduce((s, r) => s + (r.prizeAmount ?? 0), 0),
    }
  }, [filtered])

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
  const hasFilters = Boolean(q || branch || groupId)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Prized members" value={totals.members} tone="success" index={0} />
        <StatTile label="Groups" value={totals.groups} index={1} />
        <StatTile label="Won in auctions here" value={totals.viaAuction} tone="brand" index={2} />
        <StatTile
          label="Prize amount"
          value={totals.prizeAmount}
          format={inrCompact}
          tone="violet"
          index={3}
        />
      </div>

      <Toolbar
        showClear={hasFilters}
        onClear={() => {
          setQ("")
          setBranch("")
          setGroupId("")
          setPage(1)
        }}
        actions={
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
        }
      >
        <SearchInput
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          placeholder="Search name, code, mobile or seat"
          className={FILTER_WIDTH}
          aria-label="Search prized members"
        />

        {branches.length > 1 && (
          <Select
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value)
              setGroupId("")
              setPage(1)
            }}
            wrapperClassName={FILTER_WIDTH}
            aria-label="Branch"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        )}

        <Combobox
          value={groupId}
          onChange={(v) => {
            setGroupId(v)
            setPage(1)
          }}
          options={groupChoices}
          placeholder="All groups"
          searchPlaceholder="Search groups…"
          emptyText="No groups match"
          className={FILTER_WIDTH}
          aria-label="Group"
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
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-5 w-5" />}
            title={hasFilters ? "No prized members match" : "No prized members yet"}
            description={
              hasFilters
                ? "Try another name, group or branch."
                : "Members appear here once they take the pot."
            }
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH className="w-16">Seat</TH>
                    <TH>Member</TH>
                    <TH>Mobile</TH>
                    <TH>Prized due</TH>
                    <TH>Prized month</TH>
                    <TH className="text-right">Prize amount</TH>
                  </tr>
                </THead>
                <TBody>
                  {pageRows.map((r, i) => {
                    // A heading wherever the group changes, and atop every page.
                    const head = i === 0 || pageRows[i - 1].groupId !== r.groupId
                    return (
                      <Fragment key={r.ticketId}>
                        {head && (
                          <tr className="bg-surface-2">
                            <td colSpan={6} className="px-4 py-2">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="text-sm font-semibold">{r.group}</span>
                                <span className="text-xs text-muted-foreground">
                                  {r.branch} · {inr(r.groupValue)}
                                </span>
                                <Badge tone="violet" className="ml-auto normal-case">
                                  {perGroup.get(r.groupId) ?? 0} of {r.totalTickets} prized
                                </Badge>
                              </div>
                            </td>
                          </tr>
                        )}
                        <TR>
                          <TD className="tnum font-medium">{r.ticketNo}</TD>
                          <TD>
                            <div className="font-medium">{r.name || "—"}</div>
                            {r.code && (
                              <div className="text-xs text-muted-foreground">{r.code}</div>
                            )}
                          </TD>
                          <TD className="tnum text-muted-foreground">{r.mobile || "—"}</TD>
                          <TD>
                            {r.wonRound !== null ? (
                              <Badge tone={r.viaAuction ? "success" : "violet"} className="normal-case">
                                Due {r.wonRound}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TD>
                          <TD className="tnum">
                            {r.prizedOn ? (
                              <span title={formatDay(r.prizedOn)}>{monthYear(r.prizedOn)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TD>
                          <TD className="tnum text-right">
                            {r.prizeAmount !== null ? (
                              <>
                                <div className="font-medium">{inr(r.prizeAmount)}</div>
                                {r.prizeSource === "interval" && (
                                  <div className="text-2xs text-muted-foreground">as per chit interval</div>
                                )}
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TD>
                        </TR>
                      </Fragment>
                    )
                  })}
                </TBody>
              </Table>
            </TableWrap>
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              totalRows={filtered.length}
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
