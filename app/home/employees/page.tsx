"use client"

import { useMemo, useState } from "react"
import { Edit2, Plus, Trash2, Trophy, UserX } from "lucide-react"

import Modal from "@/components/admin/modal"
import { Badge, toneFor } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Field, Input, SearchInput, Select } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { ProgressBar } from "@/components/ui/progress"
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
import { inrCompact } from "@/lib/format"
import { EMPLOYEES, type Employee } from "@/lib/mock-data"

const ROLES: Employee["role"][] = ["Manager", "Agent", "Accountant", "Supervisor"]
const BRANCHES = [...new Set(EMPLOYEES.map((e) => e.branch))]

const EMPTY_FORM = {
  name: "",
  role: "Agent" as Employee["role"],
  branch: "",
  phone: "",
  email: "",
  target: "",
  status: "active" as Employee["status"],
}

function Performance({ collected, target }: { collected: number; target: number }) {
  if (!target) return <span className="text-xs text-muted-foreground">N/A</span>
  const pct = Math.round((collected / target) * 100)
  return (
    <div className="flex items-center gap-2">
      <ProgressBar pct={pct} className="w-24" />
      <span className="tnum text-xs font-semibold text-foreground">{pct}%</span>
    </div>
  )
}

export default function EmployeesPage() {
  const [data, setData] = useState<Employee[]>(EMPLOYEES)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [branchFilter, setBranchFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRows] = useState(5)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleting, setDeleting] = useState<Employee | null>(null)

  const hasFilters = Boolean(search || roleFilter || branchFilter || statusFilter)

  function handleClear() {
    setSearch("")
    setRoleFilter("")
    setBranchFilter("")
    setStatusFilter("")
    setPage(1)
  }

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(e: Employee) {
    setEditing(e)
    setForm({
      name: e.name,
      role: e.role,
      branch: e.branch,
      phone: e.phone,
      email: e.email,
      target: String(e.target),
      status: e.status,
    })
    setShowForm(true)
  }

  function handleSubmit() {
    if (!form.name || !form.branch) return
    if (editing) {
      setData((d) =>
        d.map((e) =>
          e.id === editing.id ? { ...e, ...form, target: Number(form.target) } : e
        )
      )
    } else {
      const newId = Math.max(0, ...data.map((e) => e.id)) + 1
      setData((d) => [
        ...d,
        {
          id: newId,
          ...form,
          target: Number(form.target),
          collected: 0,
          joinedDate: new Date().toLocaleDateString("en-GB"),
        },
      ])
    }
    setShowForm(false)
  }

  function confirmDelete() {
    if (!deleting) return
    setData((d) => d.filter((e) => e.id !== deleting.id))
    setDeleting(null)
  }

  const filtered = useMemo(
    () =>
      data.filter((e) => {
        const q = search.toLowerCase()
        const matchSearch =
          !q ||
          e.name.toLowerCase().includes(q) ||
          e.branch.toLowerCase().includes(q) ||
          e.phone.includes(q)
        return (
          matchSearch &&
          (!roleFilter || e.role === roleFilter) &&
          (!branchFilter || e.branch === branchFilter) &&
          (!statusFilter || e.status === statusFilter)
        )
      }),
    [data, search, roleFilter, branchFilter, statusFilter]
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice(
    (safePage - 1) * rowsPerPage,
    safePage * rowsPerPage
  )

  const topPerformer = data.reduce<Employee | null>((top, e) => {
    if (!e.target) return top
    if (!top) return e
    return e.collected / e.target > top.collected / top.target ? e : top
  }, null)

  const stats = {
    total: data.length,
    active: data.filter((e) => e.status === "active").length,
    totalTarget: data.reduce((s, e) => s + e.target, 0),
    totalCollected: data.reduce((s, e) => s + e.collected, 0),
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile index={0} label="Total staff" value={stats.total} />
        <StatTile index={1} label="Active" value={stats.active} tone="success" />
        <StatTile
          index={2}
          label="Month target"
          value={stats.totalTarget}
          format={inrCompact}
          tone="brand"
        />
        <StatTile
          index={3}
          label="Collected"
          value={stats.totalCollected}
          format={inrCompact}
          tone="violet"
        />
      </div>

      {topPerformer && topPerformer.target > 0 && (
        <div
          className="reveal flex items-center gap-3 rounded-xl border border-success/25 bg-success-soft px-5 py-3"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          <Trophy className="h-5 w-5 shrink-0 text-success-soft-foreground" />
          <p className="text-sm text-foreground">
            <span className="font-semibold text-success-soft-foreground">
              Top performer:{" "}
            </span>
            {topPerformer.name} ({topPerformer.branch}) —{" "}
            <span className="tnum font-semibold">
              {Math.round((topPerformer.collected / topPerformer.target) * 100)}%
            </span>{" "}
            of target
          </p>
        </div>
      )}

      <Toolbar
        showClear={hasFilters}
        onClear={handleClear}
        actions={
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-3.5 w-3.5" />
            Add employee
          </Button>
        }
      >
        <SearchInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Search name, branch or phone…"
          className="min-w-[220px] flex-1"
        />
        <Select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value)
            setPage(1)
          }}
          wrapperClassName="w-36"
          aria-label="Role"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
        <Select
          value={branchFilter}
          onChange={(e) => {
            setBranchFilter(e.target.value)
            setPage(1)
          }}
          wrapperClassName="w-40"
          aria-label="Branch"
        >
          <option value="">All branches</option>
          {BRANCHES.map((b) => (
            <option key={b} value={b}>
              {b}
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
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </Toolbar>

      <Card
        className="reveal overflow-hidden"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        <CardHeader>
          <CardTitle>
            Employee list
            <span className="tnum ml-2 text-xs font-normal text-muted-foreground">
              {filtered.length} records
            </span>
          </CardTitle>
        </CardHeader>

        <TableWrap>
          <Table>
            <THead>
              <tr>
                {[
                  "#",
                  "Name",
                  "Role",
                  "Branch",
                  "Phone",
                  "Target",
                  "Collected",
                  "Performance",
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
                  <td colSpan={10}>
                    <EmptyState
                      icon={<UserX className="h-5 w-5" />}
                      title="No employees found"
                      description={
                        hasFilters
                          ? "Try relaxing the filters above."
                          : "Add your first staff member to get started."
                      }
                      action={
                        hasFilters ? (
                          <Button variant="outline" size="sm" onClick={handleClear}>
                            Clear filters
                          </Button>
                        ) : (
                          <Button size="sm" onClick={openAdd}>
                            <Plus className="h-3.5 w-3.5" />
                            Add employee
                          </Button>
                        )
                      }
                    />
                  </td>
                </tr>
              ) : (
                pageRows.map((e, idx) => (
                  <TR key={e.id} index={idx} className="group">
                    <TD className="tnum">
                      {(safePage - 1) * rowsPerPage + idx + 1}
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-soft text-xs font-bold uppercase text-violet-soft-foreground">
                          {e.name.slice(0, 2)}
                        </span>
                        <span className="font-medium text-foreground">{e.name}</span>
                      </div>
                    </TD>
                    <TD>
                      <Badge tone={toneFor(e.role)}>{e.role}</Badge>
                    </TD>
                    <TD>{e.branch}</TD>
                    <TD className="tnum">{e.phone}</TD>
                    <TD className="tnum font-medium text-foreground">
                      {e.target ? inrCompact(e.target) : "—"}
                    </TD>
                    <TD className="tnum font-medium text-foreground">
                      {e.collected ? inrCompact(e.collected) : "—"}
                    </TD>
                    <TD>
                      <Performance collected={e.collected} target={e.target} />
                    </TD>
                    <TD>
                      <Badge tone={toneFor(e.status)} dot>
                        {e.status}
                      </Badge>
                    </TD>
                    <TD>
                      <div className="flex items-center gap-1 opacity-60 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => openEdit(e)}
                          aria-label={`Edit ${e.name}`}
                        >
                          <Edit2 />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setDeleting(e)}
                          aria-label={`Delete ${e.name}`}
                          className="hover:bg-danger-soft hover:text-danger-soft-foreground"
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

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit employee" : "Add employee"}
        description={
          editing ? `Updating ${editing.name}` : "Create a new staff record."
        }
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit}>
              {editing ? "Save changes" : "Add employee"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Suresh Kumar"
            />
          </Field>
          <Field label="Phone">
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="9876543001"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="suresh@chit.com"
            />
          </Field>
          <Field label="Branch">
            <Input
              value={form.branch}
              onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
              placeholder="KovilPatti"
            />
          </Field>
          <Field label="Monthly target (₹)">
            <Input
              type="number"
              min={0}
              value={form.target}
              onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
              placeholder="200000"
            />
          </Field>
          <Field label="Role">
            <Select
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({ ...f, role: e.target.value as Employee["role"] }))
              }
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" className="sm:col-span-2">
            <Select
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as Employee["status"] }))
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        size="sm"
        title="Remove employee"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete}>
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Remove{" "}
          <span className="font-semibold text-foreground">{deleting?.name}</span> from
          the staff list? This cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
