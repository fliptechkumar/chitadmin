"use client"

import { useEffect, useMemo, useState } from "react"
import { Eye, Loader2, MapPinned, Pencil, Plus, Trash2 } from "lucide-react"

import Modal from "./modal"
import RouteFormModal, {
  RouteViewModal,
  type EmployeeOption,
  type RouteRecord,
} from "./route-form-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput, Select } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import { Toolbar } from "@/components/ui/toolbar"

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function RoutesSettings() {
  const [routes, setRoutes] = useState<RouteRecord[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [branches, setBranches] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [branchFilter, setBranchFilter] = useState("")

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RouteRecord | null>(null)
  const [viewing, setViewing] = useState<RouteRecord | null>(null)
  const [deleting, setDeleting] = useState<RouteRecord | null>(null)
  const [busy, setBusy] = useState(false)

  async function loadRoutes() {
    const response = await fetch("/api/settings/routes")
    if (!response.ok) throw new Error(String(response.status))
    setRoutes((await response.json()) as RouteRecord[])
  }

  useEffect(() => {
    let active = true

    Promise.all([
      fetch("/api/settings/routes").then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/employees").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/groups").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([routeRows, employeeRows, groupRows]) => {
        if (!active) return
        setRoutes(routeRows as RouteRecord[])
        setEmployees(employeeRows as EmployeeOption[])
        // Branches are implied by the groups that exist, as elsewhere.
        setBranches([
          ...new Set((groupRows as { branchName: string }[]).map((g) => g.branchName)),
        ].sort())
      })
      .catch(() => {
        if (active) setError("Could not load routes.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return routes.filter((route) => {
      const matchesQuery =
        !q ||
        route.code.toLowerCase().includes(q) ||
        route.name.toLowerCase().includes(q) ||
        route.areas.some((a) => a.toLowerCase().includes(q)) ||
        (route.incharge?.name ?? "").toLowerCase().includes(q)

      return matchesQuery && (!branchFilter || route.branch === branchFilter)
    })
  }, [routes, search, branchFilter])

  async function handleDelete() {
    if (!deleting) return
    setBusy(true)

    const response = await fetch(`/api/settings/routes/${deleting.id}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      setError("Could not delete this route.")
      setBusy(false)
      return
    }

    setRoutes((prev) => prev.filter((r) => r.id !== deleting.id))
    setDeleting(null)
    setBusy(false)
  }

  const hasFilters = Boolean(search || branchFilter)

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12" />
        <Skeleton className="h-56" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Toolbar
        showClear={hasFilters}
        onClear={() => {
          setSearch("")
          setBranchFilter("")
        }}
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Add route
          </Button>
        }
      >
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search code, name, area or incharge…"
          className="w-full sm:w-72"
        />
        {branches.length > 1 && (
          <Select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
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

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<MapPinned className="h-5 w-5" />}
            title={hasFilters ? "No matching routes" : "No routes yet"}
            description={
              hasFilters
                ? "Try a different search or branch."
                : "Create a route to group the areas a team collects from."
            }
            action={
              !hasFilters && (
                <Button
                  onClick={() => {
                    setEditing(null)
                    setFormOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add route
                </Button>
              )
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Route</TH>
                  <TH>Branch</TH>
                  <TH>Executives</TH>
                  <TH>Incharge</TH>
                  <TH>Areas</TH>
                  <TH>Created</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody key={`${search}-${branchFilter}`}>
                {filtered.map((route, index) => (
                  <TR key={route.id} index={index}>
                    <TD>
                      <p className="font-medium text-foreground">{route.name}</p>
                      <p className="tnum text-xs text-muted-foreground">
                        {route.code}
                      </p>
                    </TD>
                    <TD className="whitespace-nowrap text-xs">{route.branch}</TD>
                    <TD>
                      {route.executives.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {route.executives.map((e) => (
                            <Badge key={e.id} tone="neutral">
                              {e.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap">
                      {route.incharge?.name ?? (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TD>
                    <TD className="max-w-[14rem]">
                      <span className="line-clamp-1 text-xs">
                        {route.areas.join(", ")}
                      </span>
                    </TD>
                    <TD className="whitespace-nowrap text-xs">
                      <span className="tnum">{formatDate(route.createdAt)}</span>
                      {route.createdBy && (
                        <span className="block text-xs text-muted-foreground">
                          {route.createdBy.name}
                        </span>
                      )}
                    </TD>
                    <TD>
                      <Badge tone={route.isActive ? "success" : "neutral"} dot>
                        {route.isActive ? "active" : "inactive"}
                      </Badge>
                    </TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`View ${route.code}`}
                          onClick={() => setViewing(route)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${route.code}`}
                          onClick={() => {
                            setEditing(route)
                            setFormOpen(true)
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${route.code}`}
                          onClick={() => setDeleting(route)}
                          className="hover:bg-danger-soft hover:text-danger-soft-foreground"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      <RouteFormModal
        open={formOpen}
        editing={editing}
        branches={branches}
        employees={employees}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          void loadRoutes()
        }}
      />

      <RouteViewModal
        route={viewing}
        onClose={() => setViewing(null)}
        onEdit={(route) => {
          setViewing(null)
          setEditing(route)
          setFormOpen(true)
        }}
      />

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete route"
        description="This removes the route and its executive assignments."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {deleting
            ? `${deleting.code} · ${deleting.name} covers ${deleting.areas.length} area(s). This cannot be undone.`
            : ""}
        </p>
      </Modal>
    </div>
  )
}
