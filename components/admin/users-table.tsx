"use client"

import { useMemo, useState } from "react"
import { Pencil, Plus, ShieldCheck, Trash2, Loader2 } from "lucide-react"

import UserFormModal, { type ManagedUser } from "./user-form-modal"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput, Select } from "@/components/ui/input"
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { Toolbar } from "@/components/ui/toolbar"
import { ROLE_LABELS, type Role } from "@/lib/roles"

const ROLE_TONE: Record<Role, BadgeTone> = {
  SUPER_ADMIN: "violet",
  CHIT_ADMIN: "brand",
  USER: "neutral",
}

function formatDate(value: string | null) {
  if (!value) return "Never"
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function UsersTable({
  initialUsers,
  allowedRoles,
  branchOptions,
  currentUserId,
}: {
  initialUsers: ManagedUser[]
  allowedRoles: Role[]
  branchOptions: string[]
  /** Used to stop an admin deleting the account they are signed in with. */
  currentUserId: number
}) {
  const [users, setUsers] = useState(initialUsers)
  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((user) => {
      const matchesRole = roleFilter === "all" || user.role === roleFilter
      const matchesQuery =
        !q ||
        user.name.toLowerCase().includes(q) ||
        user.username.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q)
      return matchesRole && matchesQuery
    })
  }, [users, query, roleFilter])

  async function refresh() {
    const response = await fetch("/api/users")
    if (response.ok) setUsers((await response.json()) as ManagedUser[])
  }

  async function handleDelete(user: ManagedUser) {
    const confirmed = window.confirm(
      `Delete ${user.username}? This signs them out and cannot be undone.`
    )
    if (!confirmed) return

    setBusyId(user.id)
    setError("")

    const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" })

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        errors?: Record<string, string>
      } | null
      setError(Object.values(body?.errors ?? {})[0] ?? "Could not delete this user.")
      setBusyId(null)
      return
    }

    setUsers((prev) => prev.filter((u) => u.id !== user.id))
    setBusyId(null)
  }

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(user: ManagedUser) {
    setEditing(user)
    setModalOpen(true)
  }

  const hasFilters = query.trim() !== "" || roleFilter !== "all"

  return (
    <div className="space-y-4">
      <Toolbar
        showClear={hasFilters}
        onClear={() => {
          setQuery("")
          setRoleFilter("all")
        }}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add user
          </Button>
        }
      >
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, username or email…"
          className="w-full sm:w-72"
        />
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | "all")}
          wrapperClassName="w-full sm:w-44"
        >
          <option value="all">All roles</option>
          {allowedRoles.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
      </Toolbar>

      {error && (
        <p className="animate-scale-in rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-soft-foreground">
          {error}
        </p>
      )}

      <Card className="reveal overflow-hidden" style={{ "--i": 2 } as React.CSSProperties}>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" />}
            title={hasFilters ? "No matching users" : "No users yet"}
            description={
              hasFilters
                ? "Try a different search or role filter."
                : "Create the first account to give someone access."
            }
            action={
              !hasFilters && (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add user
                </Button>
              )
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>User</TH>
                  <TH>Role</TH>
                  <TH>Branches</TH>
                  <TH>Status</TH>
                  <TH>Last login</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody key={`${query}-${roleFilter}`}>
                {filtered.map((user, index) => (
                  <TR key={user.id} index={index}>
                    <TD>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {user.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {user.username} · {user.email}
                        </p>
                      </div>
                    </TD>
                    <TD>
                      <Badge tone={ROLE_TONE[user.role]} className="normal-case">
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    </TD>
                    <TD>
                      {user.branches.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {user.role === "SUPER_ADMIN" ? "All branches" : "—"}
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {user.branches.map((branch) => (
                            <Badge key={branch} tone="neutral">
                              {branch}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TD>
                    <TD>
                      <Badge tone={user.isActive ? "success" : "neutral"} dot>
                        {user.isActive ? "active" : "disabled"}
                      </Badge>
                    </TD>
                    <TD className="tnum whitespace-nowrap text-xs">
                      {formatDate(user.lastLoginAt)}
                    </TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${user.username}`}
                          onClick={() => openEdit(user)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${user.username}`}
                          disabled={user.id === currentUserId || busyId === user.id}
                          title={
                            user.id === currentUserId
                              ? "You cannot delete your own account"
                              : undefined
                          }
                          onClick={() => handleDelete(user)}
                          className="hover:bg-danger-soft hover:text-danger-soft-foreground"
                        >
                          {busyId === user.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <UserFormModal
        open={modalOpen}
        editing={editing}
        allowedRoles={allowedRoles}
        branchOptions={branchOptions}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false)
          void refresh()
        }}
      />
    </div>
  )
}
