"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import {
  AlertCircle,
  Gavel,
  Loader2,
  Plus,
  Trophy,
  UserRoundPlus,
  Users,
  X,
} from "lucide-react"

import Modal from "./modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput } from "@/components/ui/input"
import { SegmentedTabs } from "@/components/ui/tabs"
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import type { AuctionDetail, HallSeat, Participant } from "@/lib/auction-types"
import { formatDay, inr } from "@/lib/format"
import { cn } from "@/lib/utils"

type Tab = "hall" | "members"

const TABS = [
  { id: "hall" as const, label: "Auction hall", icon: <Gavel className="h-3.5 w-3.5" /> },
  { id: "members" as const, label: "Group members", icon: <Users className="h-3.5 w-3.5" /> },
]

/** The seat number, shown the same way wherever a member is listed. */
function SeatNo({ no }: { no: number }) {
  return (
    <span className="tnum flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md bg-muted px-1.5 text-2xs font-bold text-foreground">
      {no}
    </span>
  )
}

/**
 * The auction hall for one round: which members of the group are down for this
 * month's auction, and who took the pot if it has been held. Assigning a member
 * records attendance only — the round's figures come from the register.
 */
export default function AuctionRoom({ initial }: { initial: AuctionDetail }) {
  const router = useRouter()

  const [detail, setDetail] = useState(initial)
  const [tab, setTab] = useState<Tab>("hall")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)

  // A refresh re-renders the server page with fresh figures; adopt them rather
  // than sitting on the copy this component last fetched.
  const [seen, setSeen] = useState(initial)
  if (seen !== initial) {
    setSeen(initial)
    setDetail(initial)
  }

  const open = detail.status === "scheduled"
  const seatedIds = useMemo(
    () => new Set(detail.hall.map((s) => s.ticketId)),
    [detail.hall]
  )
  const unassigned = detail.eligible.filter((m) => !seatedIds.has(m.ticketId))

  /** Sends one change and swaps in the round the server answers with. */
  async function send(url: string, init: RequestInit): Promise<boolean> {
    setBusy(true)
    setError("")

    try {
      const response = await fetch(url, init)
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          errors?: Record<string, string>
        } | null
        setError(Object.values(payload?.errors ?? {})[0] ?? "That did not go through.")
        return false
      }

      setDetail((await response.json()) as AuctionDetail)
      // Keeps the summary strip above — status, prize, dividend — in step.
      router.refresh()
      return true
    } catch {
      setError("Could not reach the server.")
      return false
    } finally {
      setBusy(false)
    }
  }

  const base = `/api/auctions/${detail.id}`

  function assign(ticketId: number) {
    return send(`${base}/hall`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId }),
    })
  }

  function unassign(entry: HallSeat) {
    void send(`${base}/hall/${entry.entryId}`, { method: "DELETE" })
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="animate-scale-in flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-soft-foreground">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs items={TABS} value={tab} onChange={setTab} />

        {open && (
          <Button onClick={() => setAdding(true)} disabled={unassigned.length === 0}>
            <UserRoundPlus className="h-4 w-4" />
            Add customer to hall
          </Button>
        )}
      </div>

      {tab === "hall" ? (
        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>Auction hall · due {detail.installmentNo}</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {detail.hall.length === 0
                  ? "No customer assigned to this month yet."
                  : `${detail.hall.length} of ${detail.eligible.length} eligible members assigned`}
              </p>
            </div>
            {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
          </CardHeader>

          {detail.hall.length === 0 ? (
            <EmptyState
              icon={<Gavel className="h-5 w-5" />}
              title={`No data for due no ${detail.installmentNo}`}
              description={
                open
                  ? "Assign the members of this group who are down for this month's auction."
                  : "This round was settled without anyone recorded in the hall."
              }
              action={
                open && (
                  <Button onClick={() => setAdding(true)} disabled={unassigned.length === 0}>
                    <Plus className="h-4 w-4" />
                    Add customer to hall
                  </Button>
                )
              }
            />
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>Ticket</TH>
                    <TH>Customer</TH>
                    <TH>Member ID</TH>
                    <TH>Mobile</TH>
                    <TH>Assigned</TH>
                    <TH className="text-right">Actions</TH>
                  </tr>
                </THead>
                <TBody>
                  {detail.hall.map((entry, index) => (
                    <TR
                      key={entry.entryId}
                      index={index}
                      className={cn(entry.isWinner && "bg-success-soft/50")}
                    >
                      <TD>
                        <SeatNo no={entry.ticketNo} />
                      </TD>

                      <TD>
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 truncate font-medium text-foreground">
                            {entry.name}
                          </span>
                          {entry.isWinner && (
                            <Badge tone="success">
                              <Trophy className="h-3 w-3" />
                              Winner
                            </Badge>
                          )}
                        </span>
                      </TD>

                      <TD className="tnum whitespace-nowrap">{entry.code}</TD>
                      <TD className="tnum whitespace-nowrap">{entry.mobile}</TD>
                      <TD className="tnum whitespace-nowrap">
                        {formatDay(entry.addedAt.slice(0, 10))}
                      </TD>

                      <TD>
                        <div className="flex items-center justify-end gap-1">
                          {open && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Remove ${entry.name} from the hall`}
                              disabled={busy}
                              onClick={() => unassign(entry)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </Card>
      ) : (
        <GroupMembers
          detail={detail}
          seatedIds={seatedIds}
          open={open}
          busy={busy}
          onAssign={(ticketId) => void assign(ticketId)}
        />
      )}

      <WinnerPanel detail={detail} />

      <AddCustomerModal
        open={adding}
        members={detail.eligible}
        seatedIds={seatedIds}
        busy={busy}
        onClose={() => setAdding(false)}
        onAssign={assign}
      />
    </div>
  )
}

/** Who may still bid for this group, and who has already taken the pot. */
function GroupMembers({
  detail,
  seatedIds,
  open,
  busy,
  onAssign,
}: {
  detail: AuctionDetail
  seatedIds: Set<number>
  open: boolean
  busy: boolean
  onAssign: (ticketId: number) => void
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Still eligible</CardTitle>
          <Badge tone="brand">{detail.eligible.length}</Badge>
        </CardHeader>

        {detail.eligible.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="Nobody left to bid"
            description="Every seated member has taken the pot, so no further round can be contested in this group."
          />
        ) : (
          <CardContent className="space-y-1 p-2">
            {detail.eligible.map((member) => (
              <div
                key={member.ticketId}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-muted/60"
              >
                <SeatNo no={member.ticketNo} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{member.name}</span>
                  <span className="tnum block truncate text-xs text-muted-foreground">
                    {member.code} · {member.mobile}
                  </span>
                </span>
                {seatedIds.has(member.ticketId) ? (
                  <Badge tone="brand">In the hall</Badge>
                ) : (
                  open && (
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={busy}
                      onClick={() => onAssign(member.ticketId)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Assign
                    </Button>
                  )
                )}
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Already prized</CardTitle>
          <Badge tone="violet">{detail.won.length}</Badge>
        </CardHeader>

        {detail.won.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-5 w-5" />}
            title="No seat has taken the pot"
            description="The first round of this group is still to be decided."
          />
        ) : (
          <CardContent className="space-y-1 p-2">
            {detail.won.map((member) => (
              <div
                key={member.ticketId}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-muted-foreground"
              >
                <SeatNo no={member.ticketNo} />
                <span className="min-w-0 flex-1 truncate text-sm">{member.name}</span>
                <span className="tnum shrink-0 text-xs">won due {member.wonRound}</span>
              </div>
            ))}
          </CardContent>
        )}
      </Card>
    </div>
  )
}

/** The result of the round — the register's answer to "who took this month". */
function WinnerPanel({ detail }: { detail: AuctionDetail }) {
  const winner = detail.winner

  return (
    <Card>
      <CardHeader>
        <CardTitle>Winner list · due {detail.installmentNo}</CardTitle>
        {winner && (
          <Badge tone="success" dot>
            held
          </Badge>
        )}
      </CardHeader>

      {!winner ? (
        <EmptyState
          icon={<Trophy className="h-5 w-5" />}
          title={`No winners found for due no ${detail.installmentNo}`}
          description={
            detail.status === "cancelled"
              ? "This round was cancelled, so no pot was taken."
              : "The round is still to be held."
          }
        />
      ) : (
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-success bg-success-soft px-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
              <Trophy className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-success-soft-foreground">
                {winner.name}
              </span>
              <span className="tnum block truncate text-xs text-success-soft-foreground/80">
                Ticket {winner.ticketNo} · {winner.code} · {winner.mobile}
              </span>
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/home/dues/${winner.ticketId}`}>Open statement</Link>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Prized amount", value: inr(detail.prizeAmount) },
              { label: "Discount", value: inr(detail.discount) },
              { label: "Dividend a member", value: inr(detail.dividend) },
            ].map((figure) => (
              <div
                key={figure.label}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2.5"
              >
                <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {figure.label}
                </p>
                <p className="tnum mt-0.5 text-sm font-semibold">{figure.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

/**
 * Adds customers to the hall. The dialog stays open as members are added —
 * a hall is filled a few names at a time, not one per visit.
 */
function AddCustomerModal({
  open,
  members,
  seatedIds,
  busy,
  onClose,
  onAssign,
}: {
  open: boolean
  members: Participant[]
  seatedIds: Set<number>
  busy: boolean
  onClose: () => void
  onAssign: (ticketId: number) => Promise<boolean>
}) {
  const [query, setQuery] = useState("")
  const [wasOpen, setWasOpen] = useState(open)

  // Reset per opening, derived during render so the first paint is correct.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setQuery("")
  }

  const q = query.trim().toLowerCase()
  const shown = q
    ? members.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.code.toLowerCase().includes(q) ||
          m.mobile.includes(q) ||
          String(m.ticketNo) === q
      )
    : members

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add customer to auction hall"
      description="Members of this group who have not yet taken the pot."
      size="md"
      footer={
        <Button variant="outline" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-3">
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, member ID, ticket or mobile…"
          autoFocus
        />

        <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface-2 p-1">
          {shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {members.length === 0
                ? "Every member of this group has already taken the pot."
                : "No member matches that search."}
            </p>
          ) : (
            shown.map((member) => {
              const seated = seatedIds.has(member.ticketId)
              return (
                <div
                  key={member.ticketId}
                  className="flex items-center gap-3 rounded-lg px-3 py-2"
                >
                  <SeatNo no={member.ticketNo} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{member.name}</span>
                    <span className="tnum block truncate text-xs text-muted-foreground">
                      {member.code} · {member.mobile}
                    </span>
                  </span>
                  {seated ? (
                    <Badge tone="success">Added</Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={busy}
                      onClick={() => void onAssign(member.ticketId)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </Modal>
  )
}
