"use client"

import Link from "next/link"
import { TrendingDown, TrendingUp } from "lucide-react"

import { Card } from "@/components/ui/card"
import { CountUp } from "@/components/ui/count-up"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Tone = "brand" | "success" | "warning" | "danger" | "violet" | "neutral"

const CHIP: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  danger: "bg-danger-soft text-danger-soft-foreground",
  violet: "bg-violet-soft text-violet-soft-foreground",
  neutral: "bg-muted text-muted-foreground",
}

const VALUE: Record<Tone, string> = {
  brand: "text-brand",
  success: "text-success-soft-foreground",
  warning: "text-warning-soft-foreground",
  danger: "text-danger-soft-foreground",
  violet: "text-violet-soft-foreground",
  neutral: "text-foreground",
}

/** Full KPI card: label, animated figure, trend and an icon chip. */
function StatCard({
  label,
  value,
  format,
  icon,
  tone = "brand",
  delta,
  caption,
  index = 0,
  loading = false,
  href,
}: {
  label: string
  value: number
  format?: (n: number) => string
  icon?: React.ReactNode
  tone?: Tone
  delta?: { label: string; up: boolean }
  caption?: string
  index?: number
  loading?: boolean
  /** Makes the whole card a link to the page behind the figure. */
  href?: string
}) {
  const card = (
    <Card
      interactive
      className="reveal group relative overflow-hidden p-5"
      style={{ "--i": index } as React.CSSProperties}
    >
      {/* Tinted wash that warms up on hover */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-60",
          CHIP[tone]
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-24" />
          ) : (
            <p className={cn("tnum mt-1.5 text-2xl font-bold tracking-tight", VALUE[tone])}>
              <CountUp value={value} format={format} />
            </p>
          )}
          {delta && (
            <div className="mt-1.5 flex items-center gap-1">
              {delta.up ? (
                <TrendingUp className="h-3.5 w-3.5 text-success" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-danger" />
              )}
              <span
                className={cn(
                  "text-xs font-semibold",
                  delta.up ? "text-success-soft-foreground" : "text-danger-soft-foreground"
                )}
              >
                {delta.label}
              </span>
              {caption && (
                <span className="text-xs text-muted-foreground">{caption}</span>
              )}
            </div>
          )}
          {!delta && caption && (
            <p className="mt-1.5 text-xs text-muted-foreground">{caption}</p>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105",
              CHIP[tone]
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  )

  if (!href) return card

  return (
    <Link
      href={href}
      className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {card}
    </Link>
  )
}

/** Compact figure used in the row of summary tiles above list tables. */
function StatTile({
  label,
  value,
  format,
  tone = "neutral",
  index = 0,
  loading = false,
}: {
  label: string
  value: number
  format?: (n: number) => string
  tone?: Tone
  index?: number
  loading?: boolean
}) {
  return (
    <Card
      interactive
      className="reveal p-4"
      style={{ "--i": index } as React.CSSProperties}
    >
      <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {loading ? (
        <Skeleton className="mt-2 h-6 w-20" />
      ) : (
        <p className={cn("tnum mt-1 text-xl font-bold tracking-tight", VALUE[tone])}>
          <CountUp value={value} format={format} />
        </p>
      )}
    </Card>
  )
}

export { StatCard, StatTile }
