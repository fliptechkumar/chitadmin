import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import {
  ArrowLeft,
  CalendarRange,
  Mail,
  MapPin,
  Phone,
  Repeat,
  Route,
  Ticket as TicketIcon,
  Trophy,
  Wallet,
} from "lucide-react"

import DueSchedule from "@/components/admin/due-schedule"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requireRole } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { canAccessBranch } from "@/lib/rbac"
import { positionFor } from "@/lib/dues"
import { inr } from "@/lib/format"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ ticketId: string }> }

export const metadata = { title: "Member dues" }

/** One figure in the overview strip. */
function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "danger" | "success" | "muted"
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
      <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={
          "tnum mt-0.5 text-sm font-semibold " +
          (tone === "danger"
            ? "text-danger"
            : tone === "success"
              ? "text-success-soft-foreground"
              : tone === "muted"
                ? "text-muted-foreground"
                : "text-foreground")
        }
      >
        {value}
      </p>
    </div>
  )
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0">
        <span className="block text-2xs uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="block break-words text-sm">{value || "—"}</span>
      </span>
    </div>
  )
}

export default async function MemberDuesPage({ params }: Params) {
  const user = await requireRole(["SUPER_ADMIN", "CHIT_ADMIN"])

  const ticketId = Number((await params).ticketId)
  if (!Number.isInteger(ticketId)) notFound()

  const ticket = await prisma.chitTicket.findUnique({
    where: { id: ticketId },
    include: {
      applicant: true,
      group: true,
      route: { select: { code: true, name: true } },
      dues: { orderBy: { installmentNo: "asc" } },
    },
  })

  if (!ticket || !ticket.applicant) notFound()

  // Out of scope bounces to the register rather than 404, which would wrongly
  // suggest the member does not exist.
  if (!canAccessBranch(user, ticket.group.branchName)) redirect("/home/dues")

  const applicant = ticket.applicant
  const name = `${applicant.firstName} ${applicant.lastName}`.trim()

  const rows = ticket.dues.map((d) => ({
    installmentNo: d.installmentNo,
    dueDate: d.dueDate.toISOString(),
    paidOn: d.paidOn?.toISOString() ?? null,
    amountDue: d.amountDue,
    amountPaid: d.amountPaid,
    prizeAmount: d.prizeAmount,
    dividend: d.dividend,
  }))

  const position = positionFor(rows)
  const totalDue = rows.reduce((sum, r) => sum + r.amountDue, 0)
  const totalPaid = position.paidToDate
  const address = [
    applicant.addressLine1,
    applicant.addressLine2,
    applicant.area,
    applicant.city,
    applicant.state,
    applicant.pincode,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <div className="space-y-5">
      <div
        className="reveal flex flex-wrap items-start gap-4"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
            <Badge tone="neutral">
              <TicketIcon className="h-3 w-3" />
              Ticket {ticket.ticketNo}
            </Badge>
            {ticket.isPrized && (
              <Badge tone="violet">
                <Trophy className="h-3 w-3" />
                Prized
              </Badge>
            )}
          </div>
          <p className="tnum mt-0.5 text-sm text-muted-foreground">
            {applicant.applicantCode} · {ticket.group.group} · {ticket.group.branchName}
          </p>
        </div>

        <Button variant="outline" asChild>
          <Link href="/home/dues">
            <ArrowLeft className="h-4 w-4" />
            Back to dues
          </Link>
        </Button>
      </div>

      {/* Member and chit run across the top so the schedule gets the full
          width — it carries seven columns and was the cramped half before. */}
      <Card className="reveal" style={{ "--i": 1 } as React.CSSProperties}>
        <CardContent className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Detail
            icon={<Phone className="h-3.5 w-3.5" />}
            label="Mobile"
            value={applicant.mobile}
          />
          <Detail
            icon={<Mail className="h-3.5 w-3.5" />}
            label="Email"
            value={applicant.email ?? ""}
          />
          <Detail
            icon={<Route className="h-3.5 w-3.5" />}
            label="Route"
            value={ticket.route ? `${ticket.route.code} · ${ticket.route.name}` : ""}
          />
          <Detail
            icon={<Wallet className="h-3.5 w-3.5" />}
            label="Group value"
            value={inr(ticket.group.amount)}
          />
          <Detail
            icon={<Repeat className="h-3.5 w-3.5" />}
            label="Collected"
            value={ticket.collectionType}
          />
          <Detail
            icon={<CalendarRange className="h-3.5 w-3.5" />}
            label="Runs"
            value={`${ticket.group.startDate} — ${ticket.group.endDate}`}
          />
          <div className="sm:col-span-2">
            <Detail
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="Address"
              value={address}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="reveal" style={{ "--i": 2 } as React.CSSProperties}>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <span className="text-xs text-muted-foreground">
            Instalment {position.current?.installmentNo ?? 0} of {rows.length}
          </span>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total over the chit" value={inr(totalDue)} />
          <Stat label="Received so far" value={inr(totalPaid)} tone="success" />
          <Stat
            label="Outstanding now"
            value={inr(position.outstanding)}
            tone={position.outstanding > 0 ? "danger" : "success"}
          />
          <Stat
            label="Arrears"
            value={
              position.pendingCount === 0
                ? "None"
                : `${position.pendingCount} instalment${
                    position.pendingCount === 1 ? "" : "s"
                  }`
            }
            tone={position.pendingCount > 0 ? "danger" : "success"}
          />
        </CardContent>
      </Card>

      <div className="reveal" style={{ "--i": 3 } as React.CSSProperties}>
        <h3 className="mb-3 text-sm font-semibold tracking-tight">Instalments</h3>
        <DueSchedule rows={rows} />
      </div>
    </div>
  )
}
