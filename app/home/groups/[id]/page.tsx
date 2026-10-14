import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, CalendarRange, Layers, Percent, Users } from "lucide-react"

import GroupTicketBoard from "@/components/admin/group-ticket-board"
import { Badge, toneFor } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { requireRole } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { canAccessBranch } from "@/lib/rbac"
import { serializeTicket, TICKET_SELECT } from "@/lib/ticket-select"
import { inr } from "@/lib/format"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params) {
  const id = Number((await params).id)
  if (!Number.isInteger(id)) return { title: "Chit group" }

  const group = await prisma.chitGroup.findUnique({
    where: { id },
    select: { group: true },
  })
  return { title: group ? `${group.group} · Chit group` : "Chit group" }
}

/** Small labelled figure in the summary strip. */
function Figure({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-foreground">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="tnum block truncate text-sm font-semibold">{value}</span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
    </Card>
  )
}

export default async function GroupDetailPage({ params }: Params) {
  const user = await requireRole(["SUPER_ADMIN", "CHIT_ADMIN"])

  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()

  const group = await prisma.chitGroup.findUnique({
    where: { id },
    include: { tickets: { select: TICKET_SELECT, orderBy: { ticketNo: "asc" } } },
  })
  if (!group) notFound()

  // Out-of-branch groups bounce back to the list rather than 404, which would
  // wrongly imply the group does not exist.
  if (!canAccessBranch(user, group.branchName)) redirect("/home/groups")

  const routeRows = await prisma.route.findMany({
    where: { branch: group.branchName, isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      incharge: { select: { name: true } },
      executives: {
        select: { employee: { select: { name: true } } },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { code: "asc" },
  })

  // Flattened here so the dialog can show executive and manager the moment a
  // route is picked, without another request.
  const routes = routeRows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    manager: r.incharge?.name ?? null,
    executives: r.executives.map((e) => e.employee.name),
  }))

  const filled = group.tickets.filter((t) => t.applicant || t.isCompany).length

  return (
    <div className="space-y-5">
      <div
        className="reveal flex flex-wrap items-start gap-4"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-semibold tracking-tight">{group.group}</h2>
            <Badge tone={toneFor(group.status)} dot size="md">
              {group.status}
            </Badge>
            <Badge tone="neutral">{group.specialType}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {group.branchName} branch · {group.startDate} to {group.endDate}
          </p>
        </div>

        <Button variant="outline" asChild>
          <Link href="/home/groups">
            <ArrowLeft className="h-4 w-4" />
            All groups
          </Link>
        </Button>
      </div>

      <div
        className="reveal grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <Figure
          icon={<Layers className="h-4 w-4" />}
          label="Chit value"
          value={inr(group.amount)}
        />
        <Figure
          icon={<Users className="h-4 w-4" />}
          label="Seats"
          value={`${filled} / ${group.tickets.length}`}
          sub={`${group.tickets.length - filled} vacant`}
        />
        <Figure
          icon={<Percent className="h-4 w-4" />}
          label="Commission"
          value={group.percentage}
        />
        <Figure
          icon={<CalendarRange className="h-4 w-4" />}
          label="Duration"
          value={group.startDate}
          sub={`ends ${group.endDate}`}
        />
      </div>

      <div className="reveal" style={{ "--i": 2 } as React.CSSProperties}>
        <h3 className="mb-3 text-sm font-semibold tracking-tight">Ticket roster</h3>
        <GroupTicketBoard
          groupId={group.id}
          branch={group.branchName}
          initialTickets={group.tickets.map(serializeTicket)}
          routes={routes}
        />
      </div>
    </div>
  )
}
