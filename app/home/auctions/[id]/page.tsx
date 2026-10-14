import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, Clock, Coins, Layers, Trophy, Users } from "lucide-react"

import AuctionRoom from "@/components/admin/auction-room"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { requireRole } from "@/lib/auth-server"
import { auctionDetailFor } from "@/lib/auction-hall"
import { canAccessBranch } from "@/lib/rbac"
import { formatDay, inr } from "@/lib/format"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

const STATUS_TONE: Record<string, BadgeTone> = {
  completed: "success",
  scheduled: "brand",
  cancelled: "neutral",
}

export async function generateMetadata({ params }: Params) {
  const id = Number((await params).id)
  if (!Number.isInteger(id)) return { title: "Auction" }

  const detail = await auctionDetailFor(id)
  return {
    title: detail ? `${detail.group} · due ${detail.installmentNo}` : "Auction",
  }
}

/** One labelled figure in the round's summary strip. */
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

export default async function AuctionDetailPage({ params }: Params) {
  const user = await requireRole(["SUPER_ADMIN", "CHIT_ADMIN"])

  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()

  const detail = await auctionDetailFor(id)
  if (!detail) notFound()

  // Out-of-branch rounds bounce back to the register rather than 404, which
  // would wrongly imply the round does not exist.
  if (!canAccessBranch(user, detail.branch)) redirect("/home/auctions")

  const held = detail.status === "completed"

  return (
    <div className="space-y-5">
      <div
        className="reveal flex flex-wrap items-start gap-4"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-semibold tracking-tight">{detail.group}</h2>
            <Badge tone="brand" size="md">
              Due {detail.installmentNo}
            </Badge>
            <Badge tone={STATUS_TONE[detail.status] ?? "neutral"} dot>
              {held ? "held" : detail.status}
            </Badge>
          </div>
          <p className="tnum mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            {formatDay(detail.auctionDay)}
            <Clock className="h-3.5 w-3.5" />
            {detail.auctionTime} · {detail.branch} branch
          </p>
        </div>

        <Button variant="outline" asChild>
          <Link href="/home/auctions">
            <ArrowLeft className="h-4 w-4" />
            Back to auctions
          </Link>
        </Button>
      </div>

      {/* The round's money runs across the top, so the hall below gets the
          full width — it is the part that is worked in. */}
      <div
        className="reveal grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <Figure
          icon={<Layers className="h-4 w-4" />}
          label="Chit value"
          value={inr(detail.groupValue)}
          sub={`${detail.totalTickets} seats · ${inr(detail.subscription)} a month`}
        />
        <Figure
          icon={<Trophy className="h-4 w-4" />}
          label="Prized amount"
          value={held ? inr(detail.prizeAmount) : "Not yet held"}
          sub={held ? `after ${inr(detail.discount)} discount` : "settled on auction day"}
        />
        <Figure
          icon={<Coins className="h-4 w-4" />}
          label="Dividend a member"
          value={held ? inr(detail.dividend) : "—"}
          sub={
            held
              ? `instalment ${detail.installmentNo} costs ${inr(
                  Math.max(0, detail.subscription - detail.dividend)
                )}`
              : "follows the discount bid"
          }
        />
        <Figure
          icon={<Users className="h-4 w-4" />}
          label="Seats prized"
          value={`${detail.won.length} / ${detail.totalTickets}`}
          sub={`${detail.eligible.length} may still bid`}
        />
      </div>

      <div className="reveal" style={{ "--i": 2 } as React.CSSProperties}>
        <AuctionRoom initial={detail} />
      </div>
    </div>
  )
}
