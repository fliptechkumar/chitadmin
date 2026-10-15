"use client"

import Link from "next/link"
import {
  Activity,
  AlertCircle,
  ArrowRight,
  IndianRupee,
  Plus,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react"

import { Badge, toneFor } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ProgressRing } from "@/components/ui/progress"
import { StatCard } from "@/components/ui/stat-card"
import {
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table"
import { formatDay, inr, inrCompact } from "@/lib/format"
import type { DashboardData } from "@/lib/dashboard"

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

/** Vertical bars that grow from the baseline, one after another. */
function CollectionsChart({ data }: { data: DashboardData["monthly"] }) {
  // At least 1 so an empty half-year draws flat bars instead of dividing by zero.
  const max = Math.max(1, ...data.map((d) => d.amount))
  const gridlines = [1, 0.75, 0.5, 0.25, 0]

  return (
    <div>
      <div className="relative h-44">
        {/* Value axis: label column is 40px + an 8px gap, matching the bars' pl-12 */}
        {gridlines.map((g) => (
          <div
            key={g}
            className="pointer-events-none absolute inset-x-0 flex -translate-y-1/2 items-center gap-2"
            style={{ top: `${(1 - g) * 100}%` }}
          >
            <span className="tnum w-10 shrink-0 text-right text-2xs text-muted-foreground">
              {g === 0 ? "0" : inrCompact(max * g)}
            </span>
            <span className="h-px flex-1 bg-border/70" />
          </div>
        ))}

        <div className="relative flex h-full items-end gap-2 pl-12 sm:gap-3">
          {data.map((d, i) => {
            const isPeak = d.amount > 0 && d.amount === max
            return (
              <div
                key={d.month}
                className="group/bar relative flex h-full flex-1 items-end"
              >
                {/* Hover value chip */}
                <span className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 translate-y-1 rounded-md bg-popover px-2 py-1 text-2xs font-semibold text-popover-foreground opacity-0 shadow-md ring-1 ring-border transition-all duration-200 group-hover/bar:translate-y-0 group-hover/bar:opacity-100">
                  {inrCompact(d.amount)}
                </span>
                <div
                  style={
                    {
                      height: `${(d.amount / max) * 100}%`,
                      "--i": i,
                    } as React.CSSProperties
                  }
                  className={`grow-bar w-full rounded-t-md transition-colors duration-200 ${
                    isPeak
                      ? "bg-gradient-to-t from-brand/60 to-brand"
                      : "bg-brand/25 group-hover/bar:bg-brand/50"
                  }`}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-2 pl-12 sm:gap-3">
        {data.map((d) => (
          <span
            key={d.month}
            className="flex-1 text-center text-xs font-medium text-muted-foreground"
          >
            {d.month}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard({ data }: { data: DashboardData }) {
  const recent = data.recent
  const activeGroups = data.activeGroupList

  const monthDuePct = pct(data.monthDuePaid, data.monthDue)
  const overallPct = pct(data.paidToDate, data.dueToDate)
  const seatsPct = pct(data.filledSeats, data.totalSeats)

  const change = data.lastMonthCollected
    ? ((data.monthCollected - data.lastMonthCollected) / data.lastMonthCollected) * 100
    : null

  const todayRows = [
    { label: "Collections", value: data.todayCollected, className: "text-success-soft-foreground" },
    { label: "Penalties", value: data.todayPenalties, className: "text-danger-soft-foreground" },
    { label: "Pending dues", value: data.pendingDues, className: "text-warning-soft-foreground" },
  ]

  return (
    <div className="space-y-5">
      {/* Page intro */}
      <div className="reveal flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Welcome back</h2>
          <p className="text-sm text-muted-foreground">
            Here is how collections are tracking this month.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" asChild>
            <Link href="/home/collections">
              <Plus className="h-3.5 w-3.5" />
              New entry
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          index={0}
          label="Total collections"
          value={data.totalCollected}
          format={inrCompact}
          tone="brand"
          icon={<IndianRupee className="h-5 w-5" />}
          delta={
            change === null
              ? undefined
              : { label: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`, up: change >= 0 }
          }
          caption={change === null ? "all time" : "this month vs last"}
        />
        <StatCard
          index={1}
          label="Active groups"
          value={data.activeGroups}
          tone="success"
          icon={<Users className="h-5 w-5" />}
          caption={`${data.upcomingGroups} upcoming`}
        />
        <StatCard
          index={2}
          label="Total customers"
          value={data.customers}
          tone="violet"
          icon={<UserCheck className="h-5 w-5" />}
          caption={`in ${data.filledSeats.toLocaleString("en-IN")} seats of active groups`}
        />
        <StatCard
          index={3}
          label="Pending dues"
          value={data.pendingDues}
          format={inrCompact}
          tone="warning"
          icon={<AlertCircle className="h-5 w-5" />}
          caption="overdue on saved records"
        />
      </div>

      {/* Trend + progress */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="reveal lg:col-span-2"
          style={{ "--i": 4 } as React.CSSProperties}
        >
          <CardHeader>
            <div>
              <CardTitle>Monthly collections</CardTitle>
              <CardDescription>Last six months</CardDescription>
            </div>
            <Badge tone="brand" size="md" className="tnum">
              {inrCompact(data.monthCollected)} this month
            </Badge>
          </CardHeader>
          <CardContent>
            <CollectionsChart data={data.monthly} />
          </CardContent>
        </Card>

        <Card className="reveal" style={{ "--i": 5 } as React.CSSProperties}>
          <CardHeader>
            <CardTitle>Monthly progress</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 sm:flex-row sm:justify-around lg:flex-col">
            <ProgressRing
              pct={monthDuePct}
              tone="brand"
              delay={200}
              label="This month's dues"
              caption={`${inrCompact(data.monthDuePaid)} / ${inrCompact(data.monthDue)}`}
            />
            <ProgressRing
              pct={overallPct}
              tone="success"
              delay={340}
              label="Collection rate"
              caption={`${inrCompact(data.paidToDate)} of ${inrCompact(data.dueToDate)} due`}
            />
            <ProgressRing
              pct={seatsPct}
              tone="violet"
              delay={480}
              label="Seats filled"
              caption={`${data.filledSeats} / ${data.totalSeats} seats`}
            />
          </CardContent>
        </Card>
      </div>

      {/* Recent activity + side panels */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="reveal overflow-hidden lg:col-span-2"
          style={{ "--i": 6 } as React.CSSProperties}
        >
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand" />
              <CardTitle>Recent transactions</CardTitle>
            </div>
            <Link
              href="/home/collections"
              className="group flex items-center gap-1 text-xs font-medium text-brand hover:underline"
            >
              View all
              <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </CardHeader>
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  {["Date", "Reference", "Customer", "Group", "Amount", "Source", "Status"].map(
                    (h) => (
                      <TH key={h}>{h}</TH>
                    )
                  )}
                </tr>
              </THead>
              <TBody>
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No collections recorded yet.
                    </td>
                  </tr>
                )}
                {recent.map((c, i) => (
                  <TR key={c.key} index={i}>
                    <TD className="tnum whitespace-nowrap text-xs">{formatDay(c.day)}</TD>
                    <TD className="whitespace-nowrap font-mono text-xs">{c.ref}</TD>
                    <TD className="font-medium text-foreground">{c.customer}</TD>
                    <TD>{c.group}</TD>
                    <TD className="tnum font-semibold text-foreground">
                      {inr(c.amount)}
                    </TD>
                    <TD className="capitalize">{c.source}</TD>
                    <TD>
                      <Badge tone={c.status === "part paid" ? "warning" : toneFor(c.status)}>{c.status}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </Card>

        <div className="space-y-4">
          <Card className="reveal" style={{ "--i": 7 } as React.CSSProperties}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-brand" />
                <CardTitle>Today&apos;s summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {todayRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className={`tnum text-sm font-bold ${row.className}`}>
                    {inrCompact(row.value)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="reveal" style={{ "--i": 8 } as React.CSSProperties}>
            <CardHeader>
              <div>
                <CardTitle>Active groups</CardTitle>
                <CardDescription>Most vacant seats first</CardDescription>
              </div>
              <Link
                href="/home/groups"
                className="text-xs font-medium text-brand hover:underline"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
              {activeGroups.length === 0 && (
                <p className="px-2.5 py-2 text-xs text-muted-foreground">No active groups.</p>
              )}
              {activeGroups.map((g, i) => (
                <div
                  key={g.id}
                  style={{ "--i": i } as React.CSSProperties}
                  className="reveal-fade flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {g.group}
                    </p>
                    <p className="truncate text-2xs text-muted-foreground">
                      {g.branchName}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tnum text-xs font-bold text-foreground">
                      {inrCompact(g.amount)}
                    </p>
                    <Badge tone="warning" className="mt-0.5">
                      {g.vacants} vacant
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
