"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUp, Eye, Layers, Loader2, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react"

import GroupFormModal from "@/components/admin/group-form-modal"
import Modal from "@/components/admin/modal"
import { Badge, toneFor } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput, Select } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
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
import { inrCompact, todayDisplay } from "@/lib/format"
import { toInputDate } from "@/lib/group-schema"
import type { ChitGroup } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

const COLUMNS: { label: string; key: keyof ChitGroup | null }[] = [
  { label: "#", key: "id" },
  { label: "Branch", key: "branchName" },
  { label: "Type", key: "specialType" },
  { label: "Group", key: "group" },
  { label: "%", key: "percentage" },
  { label: "Amount", key: "amount" },
  { label: "Start date", key: "startDate" },
  { label: "End date", key: "endDate" },
  { label: "Vacants", key: "vacants" },
  { label: "Status", key: "status" },
  { label: "", key: null },
]

/** Weekday a group starts on, used by the Day filter. */
function startDay(group: ChitGroup) {
  const iso = toInputDate(group.startDate)
  if (!iso) return ""
  return DAYS[new Date(`${iso}T00:00:00`).getDay()] ?? ""
}

type SortKey = keyof ChitGroup
type SortDir = "asc" | "desc"

export default function GroupsPage() {
  const [groups, setGroups] = useState<ChitGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  const [search, setSearch] = useState("")
  const [branch, setBranch] = useState("")
  const [status, setStatus] = useState("")
  const [day, setDay] = useState("")
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRows] = useState(10)
  const [sort, setSort] = useState<SortKey>("id")
  const [dir, setDir] = useState<SortDir>("asc")

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ChitGroup | null>(null)
  const [deleting, setDeleting] = useState<ChitGroup | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  const hasFilters = Boolean(search || branch || status || day)

  const loadGroups = useCallback(async () => {
    setLoading(true)
    setLoadError("")
    try {
      const res = await fetch("/api/groups")
      if (!res.ok) throw new Error("Request failed")
      setGroups(await res.json())
    } catch {
      setLoadError("Could not load chit groups.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadGroups()
  }, [loadGroups])

  const branches = useMemo(
    () => [...new Set(groups.map((g) => g.branchName))].sort(),
    [groups]
  )

  const stats = useMemo(
    () => ({
      total: groups.length,
      active: groups.filter((g) => g.status === "active").length,
      completed: groups.filter((g) => g.status === "completed").length,
      vacants: groups.reduce((s, g) => s + g.vacants, 0),
    }),
    [groups]
  )

  function toggleSort(key: SortKey) {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSort(key)
      setDir("asc")
    }
  }

  function handleClear() {
    setSearch("")
    setBranch("")
    setStatus("")
    setDay("")
    setPage(1)
  }

  function handleSaved(saved: ChitGroup) {
    setGroups((rows) =>
      rows.some((r) => r.id === saved.id)
        ? rows.map((r) => (r.id === saved.id ? saved : r))
        : [...rows, saved]
    )
    setFormOpen(false)
    setEditing(null)
  }

  async function handleDelete() {
    if (!deleting) return
    setDeletePending(true)
    setDeleteError("")
    try {
      const res = await fetch(`/api/groups/${deleting.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Request failed")
      setGroups((rows) => rows.filter((r) => r.id !== deleting.id))
      setDeleting(null)
    } catch {
      setDeleteError("Could not delete the group. Please try again.")
    } finally {
      setDeletePending(false)
    }
  }

  const filtered = groups.filter((g) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      g.group.toLowerCase().includes(q) ||
      g.branchName.toLowerCase().includes(q)
    return (
      matchSearch &&
      (!branch || g.branchName === branch) &&
      (!status || g.status === status) &&
      (!day || startDay(g) === day)
    )
  })

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sort]
    const bv = b[sort]
    if (typeof av === "number" && typeof bv === "number")
      return dir === "asc" ? av - bv : bv - av
    return dir === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av))
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage))
  const safePage = Math.min(page, totalPages)
  const pageRows = sorted.slice(
    (safePage - 1) * rowsPerPage,
    safePage * rowsPerPage
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile index={0} label="Total groups" value={stats.total} loading={loading} />
        <StatTile
          index={1}
          label="Active"
          value={stats.active}
          tone="success"
          loading={loading}
        />
        <StatTile
          index={2}
          label="Completed"
          value={stats.completed}
          tone="neutral"
          loading={loading}
        />
        <StatTile
          index={3}
          label="Vacants"
          value={stats.vacants}
          tone="warning"
          loading={loading}
        />
      </div>

      <Toolbar
        showClear={hasFilters}
        onClear={handleClear}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add group
          </Button>
        }
      >
        <SearchInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Search by group or branch…"
          className="min-w-[220px] flex-1"
        />
        <Select
          value={branch}
          onChange={(e) => {
            setBranch(e.target.value)
            setPage(1)
          }}
          wrapperClassName="w-40"
          aria-label="Branch"
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          wrapperClassName="w-36"
          aria-label="Status"
        >
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="upcoming">Upcoming</option>
        </Select>
        <Select
          value={day}
          onChange={(e) => {
            setDay(e.target.value)
            setPage(1)
          }}
          wrapperClassName="w-36"
          aria-label="Start day"
        >
          <option value="">Any day</option>
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </Toolbar>

      <Card
        className="reveal overflow-hidden"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        <CardHeader>
          <CardTitle>
            Group list — {todayDisplay()}
            <span className="tnum ml-2 text-xs font-normal text-muted-foreground">
              {filtered.length} records
            </span>
          </CardTitle>
        </CardHeader>

        <TableWrap>
          <Table>
            <THead>
              <tr>
                {COLUMNS.map(({ label, key }) => (
                  <TH
                    key={label}
                    sortable={Boolean(key)}
                    onClick={() => key && toggleSort(key)}
                    aria-sort={
                      key && sort === key
                        ? dir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {key && (
                        <ArrowUp
                          className={cn(
                            "h-3 w-3 transition-all duration-200",
                            sort === key
                              ? "text-brand opacity-100"
                              : "opacity-0 group-hover:opacity-40",
                            sort === key && dir === "desc" && "rotate-180"
                          )}
                        />
                      )}
                    </span>
                  </TH>
                ))}
              </tr>
            </THead>
            <TBody key={`${safePage}-${sorted.length}-${sort}-${dir}`}>
              {loading ? (
                Array.from({ length: rowsPerPage }).map((_, i) => (
                  <tr key={i} className="border-b border-border/60">
                    {COLUMNS.map(({ label }) => (
                      <td key={label} className="px-4 py-3.5">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : loadError ? (
                <tr>
                  <td colSpan={COLUMNS.length}>
                    <EmptyState
                      icon={<TriangleAlert className="h-5 w-5 text-danger" />}
                      title={loadError}
                      description="The groups API did not respond. Check that the database is running."
                      action={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void loadGroups()}
                        >
                          Retry
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length}>
                    <EmptyState
                      icon={<Layers className="h-5 w-5" />}
                      title="No groups found"
                      description={
                        hasFilters
                          ? "Try relaxing the filters above."
                          : "Create your first chit group to get started."
                      }
                      action={
                        hasFilters ? (
                          <Button variant="outline" size="sm" onClick={handleClear}>
                            Clear filters
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => {
                              setEditing(null)
                              setFormOpen(true)
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add group
                          </Button>
                        )
                      }
                    />
                  </td>
                </tr>
              ) : (
                pageRows.map((row, idx) => (
                  <TR key={row.id} index={idx} className="group">
                    <TD className="tnum">
                      {(safePage - 1) * rowsPerPage + idx + 1}
                    </TD>
                    <TD className="whitespace-nowrap font-medium text-foreground">
                      {row.branchName}
                    </TD>
                    <TD>{row.specialType}</TD>
                    <TD className="font-semibold text-foreground">{row.group}</TD>
                    <TD className="tnum">{row.percentage}</TD>
                    <TD className="tnum font-medium text-foreground">
                      {inrCompact(row.amount)}
                    </TD>
                    <TD className="tnum whitespace-nowrap">{row.startDate}</TD>
                    <TD className="tnum whitespace-nowrap">{row.endDate}</TD>
                    <TD>
                      <Badge
                        tone={row.vacants > 0 ? "warning" : "success"}
                        className="tnum min-w-7 justify-center"
                      >
                        {row.vacants}
                      </Badge>
                    </TD>
                    <TD>
                      <Badge tone={toneFor(row.status)}>{row.status}</Badge>
                    </TD>
                    <TD>
                      <div className="flex items-center gap-1.5 opacity-60 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
                        <Button variant="outline" size="xs" asChild>
                          <Link
                            href={`/home/groups/${row.id}`}
                            aria-label={`View ${row.group}`}
                          >
                            <Eye />
                            View
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => {
                            setEditing(row)
                            setFormOpen(true)
                          }}
                          aria-label={`Edit ${row.group}`}
                        >
                          <Pencil />
                          Edit
                        </Button>
                        <Button
                          variant="destructive-soft"
                          size="xs"
                          onClick={() => {
                            setDeleting(row)
                            setDeleteError("")
                          }}
                          aria-label={`Delete ${row.group}`}
                        >
                          <Trash2 />
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

      <GroupFormModal
        open={formOpen}
        group={editing}
        branches={branches}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSaved={handleSaved}
      />

      <Modal
        open={deleting !== null}
        size="sm"
        title="Delete chit group"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleDelete()}
              disabled={deletePending}
            >
              {deletePending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Delete <span className="font-semibold text-foreground">{deleting?.group}</span>{" "}
          ({deleting?.branchName})? This cannot be undone.
        </p>
        {deleteError && (
          <p className="animate-fade-in mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger-soft-foreground">
            {deleteError}
          </p>
        )}
      </Modal>
    </div>
  )
}
