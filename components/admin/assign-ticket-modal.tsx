"use client"

import { useEffect, useState } from "react"
import {
  AlertCircle,
  BadgeCheck,
  Check,
  Loader2,
  MapPin,
  Search,
  UserRoundCog,
  Users2,
} from "lucide-react"

import Modal from "./modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChoiceGroup } from "@/components/ui/choice-group"
import { Field, SearchInput, Select } from "@/components/ui/input"
import { inr } from "@/lib/format"
import { cn } from "@/lib/utils"

export type PickableApplicant = {
  id: number
  code: string
  name: string
  mobile: string
  area: string | null
  chitValue: number
  status: string
}

export type RouteOption = {
  id: number
  code: string
  name: string
  manager: string | null
  executives: string[]
}

const COLLECTION_TYPES = ["daily", "weekly", "monthly"] as const

/** Read-only field that fills itself from another choice. */
function DerivedField({
  label,
  value,
  placeholder,
  icon,
}: {
  label: string
  value: string | null
  placeholder: string
  icon: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      <div
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-sm",
          value ? "text-foreground" : "text-muted-foreground/70"
        )}
      >
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="truncate">{value || placeholder}</span>
      </div>
    </div>
  )
}

export default function AssignTicketModal({
  open,
  ticketNo,
  groupId,
  branch,
  routes,
  current,
  onClose,
  onAssign,
}: {
  open: boolean
  ticketNo: number | null
  groupId: number
  branch: string
  routes: RouteOption[]
  /** Pre-selects when reassigning an occupied seat. */
  current: { applicantId: number | null; routeId: number | null; collectionType: string } | null
  onClose: () => void
  onAssign: (input: {
    applicantId: number
    routeId: number | null
    collectionType: string
  }) => Promise<string | null>
}) {
  const [query, setQuery] = useState("")
  const [applicants, setApplicants] = useState<PickableApplicant[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<PickableApplicant | null>(null)
  const [routeId, setRouteId] = useState("")
  const [collectionType, setCollectionType] = useState("monthly")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [loadedFor, setLoadedFor] = useState<number | null>(null)

  // Reset per opening, derived during render so the first paint is correct.
  if (open && ticketNo !== null && loadedFor !== ticketNo) {
    setLoadedFor(ticketNo)
    setQuery("")
    setSelected(null)
    setError("")
    setRouteId(current?.routeId ? String(current.routeId) : "")
    setCollectionType(current?.collectionType ?? "monthly")
  }
  if (!open && loadedFor !== null) setLoadedFor(null)

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    if (!open) return

    const timer = setTimeout(() => {
      setLoading(true)
      const params = new URLSearchParams({
        q: query,
        branch,
        excludeGroupId: String(groupId),
      })

      fetch(`/api/applicants/available?${params}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((rows: PickableApplicant[]) => setApplicants(rows))
        .catch(() => setApplicants([]))
        .finally(() => setLoading(false))
    }, 250)

    return () => clearTimeout(timer)
  }, [query, open, branch, groupId])

  const route = routes.find((r) => String(r.id) === routeId) ?? null

  async function handleAssign() {
    if (!selected) return
    setSaving(true)
    setError("")

    const problem = await onAssign({
      applicantId: selected.id,
      routeId: routeId ? Number(routeId) : null,
      collectionType,
    })

    setSaving(false)
    if (problem) {
      setError(problem)
      return
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign member to ticket"
      description={
        ticketNo === null
          ? undefined
          : `Seating a member on ticket ${ticketNo} of this group.`
      }
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!selected || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Assign member
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && (
          <p className="animate-scale-in flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-soft-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {/* Applicant — searched rather than picked from a long dropdown, which
            is unusable once the register runs to hundreds of names. */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Applicant *
          </label>

          {selected ? (
            <div className="animate-scale-in flex items-center gap-3 rounded-lg border border-brand bg-brand-soft px-3 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold uppercase text-brand-foreground">
                {selected.name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-brand-soft-foreground">
                  {selected.name}
                </span>
                <span className="tnum block truncate text-xs text-brand-soft-foreground/80">
                  {selected.code} · {selected.mobile}
                  {selected.area ? ` · ${selected.area}` : ""}
                </span>
              </span>
              <Button variant="ghost" size="xs" onClick={() => setSelected(null)}>
                Change
              </Button>
            </div>
          ) : (
            <>
              <SearchInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, applicant ID or mobile…"
                autoFocus
              />

              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface-2 p-1">
                {loading && applicants.length === 0 ? (
                  <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching…
                  </p>
                ) : applicants.length === 0 ? (
                  <p className="flex flex-col items-center gap-1.5 py-8 text-center text-sm text-muted-foreground">
                    <Search className="h-4 w-4" />
                    No applicants available in {branch}
                    <span className="text-xs">
                      Everyone here may already hold a seat in this group.
                    </span>
                  </p>
                ) : (
                  applicants.map((applicant) => (
                    <button
                      key={applicant.id}
                      type="button"
                      onClick={() => setSelected(applicant)}
                      className="press flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold uppercase text-brand-soft-foreground">
                        {applicant.name.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {applicant.name}
                        </span>
                        <span className="tnum block truncate text-xs text-muted-foreground">
                          {applicant.code} · {applicant.mobile}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="tnum block text-xs font-medium">
                          {inr(applicant.chitValue)}
                        </span>
                        <Badge tone={applicant.status === "approved" ? "success" : "neutral"}>
                          {applicant.status}
                        </Badge>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Applicant ID is shown, never typed — it comes from the selection. */}
        <DerivedField
          label="Applicant ID"
          value={selected?.code ?? null}
          placeholder="Fills from the applicant above"
          icon={<BadgeCheck className="h-3.5 w-3.5" />}
        />

        <Field label="Collection route *">
          <Select value={routeId} onChange={(e) => setRouteId(e.target.value)}>
            <option value="">Select a route</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} · {r.name}
              </option>
            ))}
          </Select>
        </Field>

        {/* Staffing is read from the route, so re-staffing a route updates
            every seat on it rather than leaving copies behind. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <DerivedField
            label="Collection executive"
            value={route?.executives.join(", ") || null}
            placeholder={routeId ? "None on this route" : "Fills from the route"}
            icon={<Users2 className="h-3.5 w-3.5" />}
          />
          <DerivedField
            label="Manager"
            value={route?.manager ?? null}
            placeholder={routeId ? "None on this route" : "Fills from the route"}
            icon={<UserRoundCog className="h-3.5 w-3.5" />}
          />
        </div>

        {route && route.executives.length === 0 && (
          <p className="flex items-center gap-1.5 text-xs text-warning-soft-foreground">
            <AlertCircle className="h-3.5 w-3.5" />
            {route.code} has no executives assigned — set them in Settings → Routes.
          </p>
        )}

        <Field label="Collection type">
          <ChoiceGroup
            name="Collection type"
            options={COLLECTION_TYPES}
            value={collectionType}
            onChange={(next) => setCollectionType(next || "monthly")}
          />
        </Field>

        {selected && routeId && (
          <p className="flex items-center gap-1.5 rounded-lg bg-success-soft px-3 py-2 text-xs font-medium text-success-soft-foreground">
            <Check className="h-3.5 w-3.5 shrink-0" />
            {selected.name} will be collected {collectionType} on {route?.code}.
          </p>
        )}

        {!routeId && selected && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            A route can be set later, but collections need one.
          </p>
        )}
      </div>
    </Modal>
  )
}
