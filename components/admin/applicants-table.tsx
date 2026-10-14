"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  ArrowUpDown,
  FileCheck2,
  FileClock,
  Loader2,
  Trash2,
  UserPlus,
  UserRoundCog,
  Users2,
} from "lucide-react"

import Modal from "./modal"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput, Select } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { StatTile } from "@/components/ui/stat-card"
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { Toolbar } from "@/components/ui/toolbar"
import { inr, inrCompact } from "@/lib/format"
import { cn } from "@/lib/utils"

export type ApplicantRow = {
  id: number
  applicantCode: string
  branch: string
  firstName: string
  lastName: string
  mobile: string
  area: string | null
  introducerName: string | null
  chitValue: number
  status: "pending" | "allocated" | "approved" | "rejected"
  documentsUploaded: boolean
  createdAt: string
  assignedTo: { id: number; name: string } | null
}

export type EmployeeOption = { id: number; name: string; branch: string }

const STATUS_TONE: Record<ApplicantRow["status"], BadgeTone> = {
  pending: "warning",
  allocated: "brand",
  approved: "success",
  rejected: "danger",
}

const STATUSES: ApplicantRow["status"][] = [
  "pending",
  "allocated",
  "approved",
  "rejected",
]

type SortKey = "createdAt" | "name" | "chitValue"

/**
 * Deterministic avatar tint from the name, so the same person keeps the same
 * colour between renders and pages.
 */
const AVATAR_TONES = [
  "bg-brand-soft text-brand-soft-foreground",
  "bg-success-soft text-success-soft-foreground",
  "bg-violet-soft text-violet-soft-foreground",
  "bg-warning-soft text-warning-soft-foreground",
]

function avatarTone(name: string) {
  const sum = [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return AVATAR_TONES[sum % AVATAR_TONES.length]
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function ApplicantsTable({
  initialApplicants,
  employees,
  branches,
  canSeeBranchColumn,
}: {
  initialApplicants: ApplicantRow[]
  employees: EmployeeOption[]
  branches: string[]
  /** Super Admins span branches, so the column only earns its width for them. */
  canSeeBranchColumn: boolean
}) {
  const [rows, setRows] = useState(initialApplicants)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [branchFilter, setBranchFilter] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("createdAt")
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [assigning, setAssigning] = useState<ApplicantRow | null>(null)
  const [deleting, setDeleting] = useState<ApplicantRow | null>(null)

  const hasFilters = Boolean(search || statusFilter || branchFilter)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    const matched = rows.filter((row) => {
      const name = `${row.firstName} ${row.lastName}`.toLowerCase()
      const matchesQuery =
        !q ||
        name.includes(q) ||
        row.mobile.includes(q) ||
        row.applicantCode.toLowerCase().includes(q) ||
        (row.area ?? "").toLowerCase().includes(q) ||
        (row.introducerName ?? "").toLowerCase().includes(q)

      return (
        matchesQuery &&
        (!statusFilter || row.status === statusFilter) &&
        (!branchFilter || row.branch === branchFilter)
      )
    })

    return [...matched].sort((a, b) => {
      const direction = sortAsc ? 1 : -1
      if (sortKey === "name") {
        return (
          direction *
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
        )
      }
      if (sortKey === "chitValue") return direction * (a.chitValue - b.chitValue)
      return direction * (Date.parse(a.createdAt) - Date.parse(b.createdAt))
    })
  }, [rows, search, statusFilter, branchFilter, sortKey, sortAsc])

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  )

  const totals = useMemo(
    () => ({
      all: rows.length,
      pending: rows.filter((r) => r.status === "pending").length,
      approved: rows.filter((r) => r.status === "approved").length,
      value: rows.reduce((sum, r) => sum + r.chitValue, 0),
    }),
    [rows]
  )

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc((prev) => !prev)
    else {
      setSortKey(key)
      setSortAsc(key === "name")
    }
  }

  /** PATCHes one applicant and swaps the returned row into local state. */
  async function patch(id: number, body: Record<string, unknown>) {
    setBusyId(id)
    setError("")

    const response = await fetch(`/api/applicants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        errors?: Record<string, string>
        error?: string
      } | null
      setError(
        Object.values(payload?.errors ?? {})[0] ??
          payload?.error ??
          "Could not update this applicant."
      )
      setBusyId(null)
      return
    }

    const updated = (await response.json()) as ApplicantRow
    setRows((prev) => prev.map((row) => (row.id === id ? updated : row)))
    setBusyId(null)
  }

  async function handleDelete() {
    if (!deleting) return
    const id = deleting.id
    setBusyId(id)

    const response = await fetch(`/api/applicants/${id}`, { method: "DELETE" })
    if (!response.ok) {
      setError("Could not remove this applicant.")
      setBusyId(null)
      return
    }

    setRows((prev) => prev.filter((row) => row.id !== id))
    setDeleting(null)
    setBusyId(null)
  }

  // Only staff in the applicant's own branch can be assigned to it.
  const assignableEmployees = assigning
    ? employees.filter((employee) => employee.branch === assigning.branch)
    : []

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Applicants" value={totals.all} index={1} />
        <StatTile label="Awaiting review" value={totals.pending} tone="warning" index={2} />
        <StatTile label="Approved" value={totals.approved} tone="success" index={3} />
        <StatTile
          label="Total value"
          value={totals.value}
          format={inrCompact}
          tone="brand"
          index={4}
        />
      </div>

      <Toolbar
        showClear={hasFilters}
        onClear={() => {
          setSearch("")
          setStatusFilter("")
          setBranchFilter("")
          setPage(1)
        }}
        actions={
          <Button asChild>
            <Link href="/home/applicants/new">
              <UserPlus className="h-4 w-4" />
              Add applicant
            </Link>
          </Button>
        }
      >
        <SearchInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Search name, mobile, code or area…"
          className="w-full sm:w-72"
        />
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          wrapperClassName="w-full sm:w-40"
        >
          <option value="">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status[0].toUpperCase() + status.slice(1)}
            </option>
          ))}
        </Select>
        {canSeeBranchColumn && branches.length > 1 && (
          <Select
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value)
              setPage(1)
            }}
            wrapperClassName="w-full sm:w-44"
          >
            <option value="">All branches</option>
            {branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </Select>
        )}
      </Toolbar>

      {error && (
        <p className="animate-scale-in rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-soft-foreground">
          {error}
        </p>
      )}

      <Card className="reveal overflow-hidden" style={{ "--i": 5 } as React.CSSProperties}>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Users2 className="h-5 w-5" />}
            title={hasFilters ? "No matching applicants" : "No applicants yet"}
            description={
              hasFilters
                ? "Try a different search, status or branch."
                : "Enrol the first applicant to see them listed here."
            }
            action={
              !hasFilters && (
                <Button asChild>
                  <Link href="/home/applicants/new">
                    <UserPlus className="h-4 w-4" />
                    Add applicant
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH className="w-12">#</TH>
                    {canSeeBranchColumn && <TH>Branch</TH>}
                    <TH sortable onClick={() => toggleSort("name")}>
                      <span className="inline-flex items-center gap-1">
                        Name
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      </span>
                    </TH>
                    <TH>Mobile</TH>
                    <TH sortable onClick={() => toggleSort("createdAt")}>
                      <span className="inline-flex items-center gap-1">
                        Created
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      </span>
                    </TH>
                    <TH>Area</TH>
                    <TH>Introducer</TH>
                    <TH sortable className="text-right" onClick={() => toggleSort("chitValue")}>
                      <span className="inline-flex items-center gap-1">
                        Value
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      </span>
                    </TH>
                    <TH>Documents</TH>
                    <TH>Assigned to</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </tr>
                </THead>
                <TBody key={`${currentPage}-${search}-${statusFilter}-${branchFilter}-${sortKey}-${sortAsc}`}>
                  {visible.map((row, index) => {
                    const name = `${row.firstName} ${row.lastName}`.trim()
                    const busy = busyId === row.id

                    return (
                      <TR key={row.id} index={index}>
                        <TD className="tnum text-xs text-muted-foreground">
                          {(currentPage - 1) * rowsPerPage + index + 1}
                        </TD>

                        {canSeeBranchColumn && (
                          <TD className="whitespace-nowrap text-xs">{row.branch}</TD>
                        )}

                        <TD>
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase",
                                avatarTone(name)
                              )}
                            >
                              {name.slice(0, 1)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{name}</p>
                              <p className="tnum truncate text-xs text-muted-foreground">
                                {row.applicantCode}
                              </p>
                            </div>
                          </div>
                        </TD>

                        <TD className="tnum whitespace-nowrap">{row.mobile}</TD>
                        <TD className="tnum whitespace-nowrap text-xs">
                          {formatDate(row.createdAt)}
                        </TD>
                        <TD className="max-w-[10rem] truncate">{row.area ?? "—"}</TD>
                        <TD className="max-w-[10rem] truncate">
                          {row.introducerName ?? "—"}
                        </TD>
                        <TD className="tnum whitespace-nowrap text-right font-medium text-foreground">
                          {inr(row.chitValue)}
                        </TD>

                        <TD>
                          {/* File storage is not wired yet, so this records whether
                              the branch has collected the paperwork. */}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              patch(row.id, { documentsUploaded: !row.documentsUploaded })
                            }
                            className="press disabled:opacity-60"
                            title={
                              row.documentsUploaded
                                ? "Mark documents as not collected"
                                : "Mark documents as collected"
                            }
                          >
                            <Badge tone={row.documentsUploaded ? "success" : "neutral"}>
                              {row.documentsUploaded ? (
                                <FileCheck2 className="h-3 w-3" />
                              ) : (
                                <FileClock className="h-3 w-3" />
                              )}
                              {row.documentsUploaded ? "Collected" : "Pending"}
                            </Badge>
                          </button>
                        </TD>

                        <TD>
                          <button
                            type="button"
                            onClick={() => setAssigning(row)}
                            className="press flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-muted"
                          >
                            {row.assignedTo ? (
                              <>
                                <span
                                  className={cn(
                                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-2xs font-bold uppercase",
                                    avatarTone(row.assignedTo.name)
                                  )}
                                >
                                  {row.assignedTo.name.slice(0, 1)}
                                </span>
                                <span className="max-w-[7rem] truncate text-xs">
                                  {row.assignedTo.name}
                                </span>
                              </>
                            ) : (
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <UserRoundCog className="h-3.5 w-3.5" />
                                Assign
                              </span>
                            )}
                          </button>
                        </TD>

                        <TD>
                          {/* Status is the main workflow action, so it is an
                              inline control rather than a read-only chip. */}
                          <div className="relative inline-flex items-center">
                            <Badge tone={STATUS_TONE[row.status]} dot size="md">
                              {row.status}
                            </Badge>
                            <select
                              aria-label={`Change status for ${name}`}
                              value={row.status}
                              disabled={busy}
                              onChange={(e) => patch(row.id, { status: e.target.value })}
                              className="absolute inset-0 cursor-pointer opacity-0"
                            >
                              {STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </div>
                        </TD>

                        <TD>
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove ${name}`}
                              disabled={busy}
                              onClick={() => setDeleting(row)}
                              className="hover:bg-danger-soft hover:text-danger-soft-foreground"
                            >
                              {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </TD>
                      </TR>
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

      <Modal
        open={Boolean(assigning)}
        onClose={() => setAssigning(null)}
        title="Assign applicant"
        description={
          assigning
            ? `Choose the staff member handling ${assigning.firstName} ${assigning.lastName}.`
            : undefined
        }
        size="sm"
      >
        {assignableEmployees.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No staff are recorded in the {assigning?.branch} branch yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {assigning?.assignedTo && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    void patch(assigning.id, { assignedToId: null })
                    setAssigning(null)
                  }}
                  className="press w-full rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft"
                >
                  Unassign
                </button>
              </li>
            )}
            {assignableEmployees.map((employee) => {
              const selected = assigning?.assignedTo?.id === employee.id
              return (
                <li key={employee.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (assigning) {
                        void patch(assigning.id, { assignedToId: employee.id })
                      }
                      setAssigning(null)
                    }}
                    className={cn(
                      "press flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                      selected && "bg-brand-soft text-brand-soft-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase",
                        avatarTone(employee.name)
                      )}
                    >
                      {employee.name.slice(0, 1)}
                    </span>
                    {employee.name}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Remove applicant"
        description="This permanently deletes the enrolment record."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busyId !== null}>
              {busyId !== null && <Loader2 className="h-4 w-4 animate-spin" />}
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {deleting
            ? `${deleting.firstName} ${deleting.lastName} (${deleting.applicantCode}) will be removed from the ${deleting.branch} branch.`
            : ""}
        </p>
      </Modal>
    </div>
  )
}
