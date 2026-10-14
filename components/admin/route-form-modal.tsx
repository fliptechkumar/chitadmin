"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Loader2, MapPin, Plus, X } from "lucide-react"

import Modal from "./modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, Input, Select, Textarea } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { RouteErrors } from "@/lib/route-schema"
import { cn } from "@/lib/utils"

export type EmployeeOption = { id: number; name: string; branch: string }

export type RouteRecord = {
  id: number
  code: string
  name: string
  branch: string
  areas: string[]
  notes: string
  isActive: boolean
  incharge: { id: number; name: string } | null
  createdBy: { id: number; name: string; username: string } | null
  executives: { id: number; name: string; branch: string }[]
  createdAt: string
  updatedAt: string
}

type FormState = {
  code: string
  name: string
  branch: string
  areas: string[]
  executiveIds: number[]
  inchargeId: string
  notes: string
  isActive: boolean
}

const EMPTY: FormState = {
  code: "",
  name: "",
  branch: "",
  areas: [],
  executiveIds: [],
  inchargeId: "",
  notes: "",
  isActive: true,
}

export default function RouteFormModal({
  open,
  editing,
  branches,
  employees,
  onClose,
  onSaved,
}: {
  open: boolean
  editing: RouteRecord | null
  branches: string[]
  employees: EmployeeOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [areaDraft, setAreaDraft] = useState("")
  const [errors, setErrors] = useState<RouteErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  // Reset on open, derived during render so the first paint is already correct.
  const openKey = open ? String(editing?.id ?? "new") : null

  if (openKey !== null && openKey !== loadedFor) {
    setLoadedFor(openKey)
    setErrors({})
    setAreaDraft("")
    setForm(
      editing
        ? {
            code: editing.code,
            name: editing.name,
            branch: editing.branch,
            areas: editing.areas,
            executiveIds: editing.executives.map((e) => e.id),
            inchargeId: editing.incharge ? String(editing.incharge.id) : "",
            notes: editing.notes,
            isActive: editing.isActive,
          }
        : { ...EMPTY, branch: branches.length === 1 ? branches[0] : "" }
    )
  }

  if (openKey === null && loadedFor !== null) setLoadedFor(null)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key as keyof RouteErrors]) return prev
      const next = { ...prev }
      delete next[key as keyof RouteErrors]
      return next
    })
  }

  function addArea() {
    const value = areaDraft.trim()
    if (!value) return
    if (!form.areas.includes(value)) set("areas", [...form.areas, value])
    setAreaDraft("")
  }

  function toggleExecutive(id: number) {
    set(
      "executiveIds",
      form.executiveIds.includes(id)
        ? form.executiveIds.filter((x) => x !== id)
        : [...form.executiveIds, id]
    )
  }

  async function handleSubmit() {
    setSubmitting(true)
    setErrors({})

    const response = await fetch(
      editing ? `/api/settings/routes/${editing.id}` : "/api/settings/routes",
      {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          inchargeId: form.inchargeId ? Number(form.inchargeId) : null,
        }),
      }
    )

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        errors?: RouteErrors
      } | null
      setErrors(body?.errors ?? { code: "Could not save this route." })
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onSaved()
  }

  // Staff are filtered to the chosen branch — assigning someone from another
  // branch to a route would be a data-entry mistake.
  const branchStaff = form.branch
    ? employees.filter((e) => e.branch === form.branch)
    : employees

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.code}` : "Add route"}
      description="A route is the set of areas one team collects from."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Create route"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Route code *" error={errors.code} hint="e.g. R10">
            <Input
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              placeholder="R10"
            />
          </Field>

          <Field label="Route name *" error={errors.name}>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Kovilpatti"
            />
          </Field>

          <Field label="Branch *" error={errors.branch}>
            <Select
              value={form.branch}
              onChange={(e) => {
                set("branch", e.target.value)
                // Staff lists are branch-specific, so clear stale picks.
                set("executiveIds", [])
                set("inchargeId", "")
              }}
            >
              <option value="">Select a branch</option>
              {branches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Incharge" error={errors.inchargeId}>
            <Select
              value={form.inchargeId}
              onChange={(e) => set("inchargeId", e.target.value)}
              disabled={!form.branch}
            >
              <option value="">
                {form.branch ? "Not assigned" : "Select a branch first"}
              </option>
              {branchStaff.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Areas covered *"
          error={errors.areas}
          hint="Add as many places as the round covers"
        >
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={areaDraft}
                onChange={(e) => setAreaDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter adds an area rather than submitting the dialog.
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addArea()
                  }
                }}
                placeholder="Type an area and press Enter"
              />
              <Button variant="outline" onClick={addArea} disabled={!areaDraft.trim()}>
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>

            {form.areas.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.areas.map((area) => (
                  <span
                    key={area}
                    className="animate-scale-in inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-soft-foreground"
                  >
                    <MapPin className="h-3 w-3" />
                    {area}
                    <button
                      type="button"
                      aria-label={`Remove ${area}`}
                      onClick={() => set("areas", form.areas.filter((a) => a !== area))}
                      className="press ml-0.5 rounded-full p-0.5 hover:bg-brand/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </Field>

        <Field
          label="Executives"
          error={errors.executiveIds}
          hint="Any number of field staff can share a route"
        >
          {!form.branch ? (
            <p className="text-xs text-muted-foreground">Select a branch first.</p>
          ) : branchStaff.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No staff recorded in {form.branch}.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {branchStaff.map((employee) => {
                const selected = form.executiveIds.includes(employee.id)
                return (
                  <button
                    key={employee.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleExecutive(employee.id)}
                    className={cn(
                      "press rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      selected
                        ? "border-brand bg-brand text-brand-foreground"
                        : "border-input bg-surface-2 text-muted-foreground hover:border-brand/40 hover:text-foreground"
                    )}
                  >
                    {employee.name}
                  </button>
                )
              })}
            </div>
          )}
        </Field>

        <Field label="Notes" error={errors.notes}>
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Anything the team should know about this round"
          />
        </Field>

        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3.5 py-3">
          <div>
            <p className="text-sm font-medium">Route active</p>
            <p className="text-xs text-muted-foreground">
              Inactive routes stay on record but are not offered for collection.
            </p>
          </div>
          <Switch
            checked={form.isActive}
            onCheckedChange={(next) => set("isActive", next)}
            label="Route active"
          />
        </div>

        {errors.id && (
          <p className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-soft-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errors.id}
          </p>
        )}
      </div>
    </Modal>
  )
}

/** Read-only detail view behind the "View" action. */
export function RouteViewModal({
  route,
  onClose,
  onEdit,
}: {
  route: RouteRecord | null
  onClose: () => void
  onEdit: (route: RouteRecord) => void
}) {
  const [fetched, setFetched] = useState<RouteRecord | null>(null)
  const [fetchedFor, setFetchedFor] = useState<number | null>(null)

  // Discard the previous route's detail during render, so the panel never shows
  // one route's areas under another's name while the fetch is in flight.
  if (route && fetchedFor !== route.id) {
    setFetchedFor(route.id)
    setFetched(null)
  }

  const routeId = route?.id ?? null

  // Re-fetch on open so the panel shows current data, not a stale list row.
  useEffect(() => {
    if (routeId === null) return

    let active = true
    fetch(`/api/settings/routes/${routeId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: RouteRecord | null) => {
        if (active && data) setFetched(data)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [routeId])

  const data = fetched ?? route

  return (
    <Modal
      open={Boolean(route)}
      onClose={onClose}
      title={data ? `${data.code} · ${data.name}` : "Route"}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {data && <Button onClick={() => onEdit(data)}>Edit route</Button>}
        </>
      }
    >
      {data && (
        <dl className="space-y-3 text-sm">
          {[
            ["Branch", data.branch],
            ["Incharge", data.incharge?.name ?? "Not assigned"],
            [
              "Executives",
              data.executives.length
                ? data.executives.map((e) => e.name).join(", ")
                : "None assigned",
            ],
            ["Created by", data.createdBy?.name ?? "—"],
            ["Created on", new Date(data.createdAt).toLocaleDateString("en-IN")],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-border/60 pb-2">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}

          <div className="space-y-1.5">
            <dt className="text-muted-foreground">Areas covered</dt>
            <dd className="flex flex-wrap gap-1.5">
              {data.areas.map((area) => (
                <Badge key={area} tone="brand">
                  {area}
                </Badge>
              ))}
            </dd>
          </div>

          {data.notes && (
            <div className="space-y-1">
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="rounded-lg bg-surface-2 px-3 py-2 text-sm">{data.notes}</dd>
            </div>
          )}

          <div className="flex justify-between pt-1">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <Badge tone={data.isActive ? "success" : "neutral"} dot>
                {data.isActive ? "active" : "inactive"}
              </Badge>
            </dd>
          </div>
        </dl>
      )}
    </Modal>
  )
}
