"use client"

import { useMemo, useState } from "react"
import {
  Building2,
  Loader2,
  MapPin,
  Plus,
  Ticket as TicketIcon,
  UserMinus,
  UserRound,
} from "lucide-react"

import AssignTicketModal, { type RouteOption } from "./assign-ticket-modal"
import Modal from "./modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/ui/input"
import { SegmentedTabs } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export type Ticket = {
  id: number
  ticketNo: number
  isCompany: boolean
  status: "active" | "suspended" | "closed"
  collectionType: "daily" | "weekly" | "monthly"
  assignedAt: string | null
  applicant: {
    id: number
    code: string
    name: string
    mobile: string
    area: string | null
  } | null
  route: RouteOption | null
}

type Filter = "all" | "filled" | "vacant"

const FILTERS = [
  { id: "all" as const, label: "All seats" },
  { id: "filled" as const, label: "Filled" },
  { id: "vacant" as const, label: "Vacant" },
]

export default function GroupTicketBoard({
  groupId,
  branch,
  initialTickets,
  routes,
}: {
  groupId: number
  branch: string
  initialTickets: Ticket[]
  routes: RouteOption[]
}) {
  const [tickets, setTickets] = useState(initialTickets)
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")
  const [assigning, setAssigning] = useState<number | null>(null)
  const [clearing, setClearing] = useState<Ticket | null>(null)
  const [busyNo, setBusyNo] = useState<number | null>(null)
  const [error, setError] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tickets.filter((t) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "filled"
          ? Boolean(t.applicant) || t.isCompany
          : !t.applicant && !t.isCompany)

      const matchesSearch =
        !q ||
        String(t.ticketNo) === q ||
        (t.applicant?.name ?? "").toLowerCase().includes(q) ||
        (t.applicant?.code ?? "").toLowerCase().includes(q) ||
        (t.applicant?.mobile ?? "").includes(q)

      return matchesFilter && matchesSearch
    })
  }, [tickets, filter, search])

  const filledCount = tickets.filter((t) => t.applicant || t.isCompany).length

  /** PATCHes a seat and swaps the returned row in. Returns an error message. */
  async function patchTicket(
    ticketNo: number,
    body: Record<string, unknown>
  ): Promise<string | null> {
    setBusyNo(ticketNo)
    setError("")

    const response = await fetch(`/api/groups/${groupId}/tickets/${ticketNo}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        errors?: Record<string, string>
      } | null
      const message =
        Object.values(payload?.errors ?? {})[0] ?? "Could not update this ticket."
      setBusyNo(null)
      return message
    }

    const updated = (await response.json()) as Ticket
    setTickets((prev) => prev.map((t) => (t.ticketNo === ticketNo ? updated : t)))
    setBusyNo(null)
    return null
  }

  async function handleClear() {
    if (!clearing) return
    const problem = await patchTicket(clearing.ticketNo, { applicantId: null })
    if (problem) setError(problem)
    setClearing(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedTabs items={FILTERS} value={filter} onChange={setFilter} />
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ticket no, name or phone…"
          className="w-full sm:w-64"
        />
        <p className="ml-auto text-xs text-muted-foreground">
          <span className="tnum font-semibold text-foreground">{filledCount}</span> of{" "}
          <span className="tnum">{tickets.length}</span> seats taken
        </p>
      </div>

      {error && (
        <p className="animate-scale-in rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-soft-foreground">
          {error}
        </p>
      )}

      {/*
        A seat grid rather than a long table: tickets are a fixed, countable set
        where the vacancy pattern is the thing you scan for, and that reads far
        faster as cards than as rows of dashes.
      */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((ticket, index) => {
          const busy = busyNo === ticket.ticketNo
          const vacant = !ticket.applicant && !ticket.isCompany

          return (
            <div
              key={ticket.id}
              style={{ "--i": index % 12 } as React.CSSProperties}
              className={cn(
                "reveal-fade flex min-h-[8.5rem] flex-col rounded-xl border p-3.5 transition-colors",
                ticket.isCompany
                  ? "border-violet/30 bg-violet-soft/40"
                  : vacant
                    ? "border-dashed border-border bg-surface-2 hover:border-brand/40"
                    : "border-border bg-card"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "tnum flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-xs font-bold",
                    ticket.isCompany
                      ? "bg-violet text-violet-foreground"
                      : vacant
                        ? "bg-muted text-muted-foreground"
                        : "bg-brand text-brand-foreground"
                  )}
                >
                  {ticket.ticketNo}
                </span>

                {ticket.isCompany ? (
                  <Badge tone="violet">
                    <Building2 className="h-3 w-3" />
                    Company
                  </Badge>
                ) : ticket.applicant ? (
                  <Badge tone={ticket.status === "active" ? "success" : "warning"} dot>
                    {ticket.status}
                  </Badge>
                ) : (
                  <Badge tone="neutral">Vacant</Badge>
                )}
              </div>

              <div className="mt-2.5 min-w-0 flex-1">
                {ticket.isCompany ? (
                  <p className="text-sm font-medium text-foreground">
                    Held by the company
                  </p>
                ) : ticket.applicant ? (
                  <>
                    <p className="truncate text-sm font-medium text-foreground">
                      {ticket.applicant.name}
                    </p>
                    <p className="tnum truncate text-xs text-muted-foreground">
                      {ticket.applicant.code} · {ticket.applicant.mobile}
                    </p>
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {ticket.route ? (
                        <span className="truncate">
                          {ticket.route.code} · {ticket.collectionType}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/70">No route set</span>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <TicketIcon className="h-4 w-4" />
                    Open seat
                  </p>
                )}
              </div>

              {!ticket.isCompany && (
                <div className="mt-3 flex gap-1.5">
                  {ticket.applicant ? (
                    <>
                      <Button
                        variant="outline"
                        size="xs"
                        className="flex-1"
                        disabled={busy}
                        onClick={() => setAssigning(ticket.ticketNo)}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserRound className="h-3.5 w-3.5" />
                        )}
                        Change
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Clear ticket ${ticket.ticketNo}`}
                        disabled={busy}
                        onClick={() => setClearing(ticket)}
                        className="hover:bg-danger-soft hover:text-danger-soft-foreground"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="xs"
                      className="w-full"
                      disabled={busy}
                      onClick={() => setAssigning(ticket.ticketNo)}
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Assign
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          No seats match this filter.
        </p>
      )}

      <AssignTicketModal
        open={assigning !== null}
        ticketNo={assigning}
        groupId={groupId}
        branch={branch}
        routes={routes}
        current={
          assigning === null
            ? null
            : (() => {
                const seat = tickets.find((t) => t.ticketNo === assigning)
                return {
                  applicantId: seat?.applicant?.id ?? null,
                  routeId: seat?.route?.id ?? null,
                  collectionType: seat?.collectionType ?? "monthly",
                }
              })()
        }
        onClose={() => setAssigning(null)}
        onAssign={(input) => patchTicket(assigning as number, input)}
      />

      <Modal
        open={Boolean(clearing)}
        onClose={() => setClearing(null)}
        title="Clear this seat"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setClearing(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClear} disabled={busyNo !== null}>
              {busyNo !== null && <Loader2 className="h-4 w-4 animate-spin" />}
              Clear seat
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {clearing?.applicant
            ? `${clearing.applicant.name} will be removed from ticket ${clearing.ticketNo}, leaving it vacant. Their applicant record stays on file.`
            : ""}
        </p>
      </Modal>
    </div>
  )
}
