"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  CalendarDays,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Wallet,
} from "lucide-react"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ProgressRing, toneForPct } from "@/components/ui/progress"
import type { FirstDueGroup } from "@/lib/first-dues"
import { formatDay, inr, inrCompact } from "@/lib/format"
import { cn } from "@/lib/utils"

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

/** Whole days from `from` to `to`, both yyyy-mm-dd. */
function daysBetween(from: string, to: string) {
  const at = (day: string) => {
    const [y, m, d] = day.split("-").map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((at(to) - at(from)) / 86_400_000)
}

/** Where the first instalment stands against today. */
function dueStatus(g: FirstDueGroup, today: string): { label: string; tone: BadgeTone } {
  if (g.expected > 0 && g.collected >= g.expected) return { label: "Fully collected", tone: "success" }
  const days = daysBetween(today, g.startDay)
  if (days > 1) return { label: `Due in ${days} days`, tone: "brand" }
  if (days === 1) return { label: "Due tomorrow", tone: "brand" }
  if (days === 0) return { label: "Due today", tone: "warning" }
  return { label: `${-days} day${days === -1 ? "" : "s"} overdue`, tone: "danger" }
}

/** One bar split into members, the company seat and vacancies. */
function SeatBar({ seats }: { seats: FirstDueGroup["seats"] }) {
  const total = Math.max(1, seats.total)
  const parts = [
    { key: "Members", value: seats.filled, fill: "bg-brand", text: "text-foreground" },
    { key: "Company", value: seats.company, fill: "bg-violet", text: "text-foreground" },
    {
      key: "Vacant",
      value: seats.vacant,
      fill: "bg-muted",
      text: seats.vacant > 0 ? "text-danger-soft-foreground" : "text-foreground",
    },
  ]

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>Seats</span>
        <span className="tnum">{seats.total} total</span>
      </div>
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-muted">
        {parts.map(
          (p) =>
            p.value > 0 && (
              <div
                key={p.key}
                className={cn("h-full first:rounded-l-full last:rounded-r-full", p.fill)}
                style={{ width: `${(p.value / total) * 100}%` }}
              />
            )
        )}
      </div>
      <div className="flex items-center gap-4">
        {parts.map((p) => (
          <span key={p.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-full ring-1 ring-border", p.fill)} />
            {p.key}
            <span className={cn("tnum font-semibold", p.text)}>{p.value}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function GroupSlide({ g, today, index }: { g: FirstDueGroup; today: string; index: number }) {
  const status = dueStatus(g, today)
  const collectedPct = pct(g.collected, g.expected)

  return (
    <article
      data-slide
      style={{ "--i": index } as React.CSSProperties}
      className="reveal-fade lift group/slide flex w-[86%] shrink-0 snap-start flex-col gap-4 rounded-xl border border-border bg-card p-4 hover:border-brand/30 sm:w-[calc(50%-0.5rem)] xl:w-[calc(33.333%-0.667rem)] 2xl:w-[calc(25%-0.75rem)]"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/home/groups/${g.id}`}
            className="flex items-center gap-1 text-base font-semibold tracking-tight text-foreground hover:text-brand"
          >
            <span className="truncate">{g.group}</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover/slide:opacity-60" />
          </Link>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{g.branchName}</span>
            <span aria-hidden>·</span>
            <span className="tnum">{inrCompact(g.chitValue)} chit</span>
          </p>
        </div>
        <Badge tone={status.tone} dot className="shrink-0 normal-case">
          {status.label}
        </Badge>
      </header>

      <div className="flex items-center gap-4">
        <ProgressRing pct={collectedPct} tone={toneForPct(collectedPct)} size={68} stroke={7} delay={200 + index * 80} />
        <div className="min-w-0">
          <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Collected</p>
          <p className="tnum truncate text-xl font-bold tracking-tight text-foreground">{inr(g.collected)}</p>
          <p className="tnum truncate text-xs text-muted-foreground">
            of {inr(g.expected)} · {g.paidMembers}/{g.seats.filled} paid
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
        <div className="bg-surface-2 px-3 py-2">
          <dt className="flex items-center gap-1 text-2xs text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            Starts
          </dt>
          <dd className="tnum mt-0.5 text-sm font-semibold text-foreground">{formatDay(g.startDay)}</dd>
        </div>
        <div className="bg-surface-2 px-3 py-2">
          <dt className="flex items-center gap-1 text-2xs text-muted-foreground">
            <Wallet className="h-3 w-3" />
            1st instalment
          </dt>
          <dd className="tnum mt-0.5 text-sm font-semibold text-foreground">{inr(g.installment)}</dd>
        </div>
      </dl>

      <SeatBar seats={g.seats} />
    </article>
  )
}

export default function FirstDuesSlider({
  groups,
  today,
  monthLabel,
  index = 0,
}: {
  groups: FirstDueGroup[]
  today: string
  monthLabel: string
  /** Position in the dashboard's entrance sequence. */
  index?: number
}) {
  const track = useRef<HTMLDivElement>(null)
  // `first` is the leftmost fully shown slide; `perView` how many fit at once.
  const [view, setView] = useState({ first: 0, perView: 1, start: true, end: true })

  const expected = groups.reduce((s, g) => s + g.expected, 0)
  const collected = groups.reduce((s, g) => s + g.collected, 0)
  const overallPct = pct(collected, expected)

  /** Distance between the starts of neighbouring slides: card width + gap. */
  const stepOf = (el: HTMLElement) => {
    const slides = el.querySelectorAll<HTMLElement>("[data-slide]")
    return slides.length > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : el.clientWidth
  }

  const measure = useCallback(() => {
    const el = track.current
    if (!el) return
    const step = Math.max(1, stepOf(el))
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
    const perView = Math.max(1, Math.floor((el.clientWidth + 1) / step))
    setView({
      // At the far end the last slides are all shown, even if the first is cut.
      first: end ? Math.max(0, groups.length - perView) : Math.round(el.scrollLeft / step),
      perView,
      start: el.scrollLeft <= 4,
      end,
    })
  }, [groups.length])

  useEffect(() => {
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [measure])

  /** Brings slide `i` to the leading edge, clamped so the track stays full. */
  function goTo(i: number) {
    const el = track.current
    if (!el) return
    const index = Math.min(Math.max(0, i), Math.max(0, groups.length - view.perView))
    el.scrollTo({ left: index * stepOf(el), behavior: "smooth" })
  }

  const pages = Math.max(1, Math.ceil(groups.length / view.perView))
  const activePage = view.end ? pages - 1 : Math.min(pages - 1, Math.round(view.first / view.perView))

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") goTo(view.first + view.perView)
    else if (e.key === "ArrowLeft") goTo(view.first - view.perView)
    else return
    e.preventDefault()
  }

  return (
    <Card className="reveal overflow-hidden" style={{ "--i": index } as React.CSSProperties}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
            <CalendarClock className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">First dues · {monthLabel}</h2>
            <p className="text-xs text-muted-foreground">
              {groups.length === 0
                ? "No group starts collecting this month"
                : `${groups.length} group${groups.length === 1 ? "" : "s"} collecting their first instalment`}
            </p>
          </div>
        </div>

        {groups.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="tnum text-sm font-bold text-foreground">
                {inrCompact(collected)}
                <span className="font-medium text-muted-foreground"> / {inrCompact(expected)}</span>
              </p>
              <p className="text-2xs text-muted-foreground">{overallPct}% collected overall</p>
            </div>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => goTo(view.first - view.perView)}
                disabled={view.start}
                aria-label="Previous groups"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => goTo(view.first + view.perView)}
                disabled={view.end}
                aria-label="Next groups"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </div>

      {groups.length > 0 && (
        <div className="space-y-3 py-4">
          <div
            ref={track}
            onScroll={measure}
            onKeyDown={onKeyDown}
            role="region"
            aria-roledescription="carousel"
            aria-label={`First dues for ${monthLabel}`}
            tabIndex={0}
            className="hide-scrollbar flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-1 outline-none"
          >
            {groups.map((g, i) => (
              <GroupSlide key={g.id} g={g} today={today} index={i} />
            ))}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <div className="flex gap-1.5">
                {Array.from({ length: pages }, (_, p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => goTo(p * view.perView)}
                    aria-label={`Page ${p + 1} of ${pages}`}
                    aria-current={p === activePage}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      p === activePage ? "w-5 bg-brand" : "w-1.5 bg-border hover:bg-muted-foreground/50"
                    )}
                  />
                ))}
              </div>
              <span className="tnum text-2xs text-muted-foreground">
                {Math.min(groups.length, view.first + 1)}–{Math.min(groups.length, view.first + view.perView)} of{" "}
                {groups.length}
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
