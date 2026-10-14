import "server-only"

import { prisma } from "@/lib/prisma"
import {
  blankRows,
  type ChitIntervalConfig,
  type IntervalInput,
  type SchemeOption,
} from "@/lib/chit-interval"

/** Every plan the groups register uses, with what has been configured. */
export async function listSchemes(): Promise<SchemeOption[]> {
  const [groups, intervals] = await Promise.all([
    prisma.chitGroup.groupBy({
      by: ["percentage", "amount", "totalTickets"],
      _count: { _all: true },
    }),
    prisma.chitInterval.findMany({ select: { scheme: true, months: true } }),
  ])

  const byScheme = new Map<string, SchemeOption & { tally: Map<number, number> }>()
  for (const g of groups) {
    const entry =
      byScheme.get(g.percentage) ??
      { scheme: g.percentage, chitValue: g.amount, months: g.totalTickets, groups: 0, configured: [], tally: new Map() }
    entry.groups += g._count._all
    entry.tally.set(g.totalTickets, (entry.tally.get(g.totalTickets) ?? 0) + g._count._all)
    byScheme.set(g.percentage, entry)
  }

  return [...byScheme.values()]
    .map(({ tally, ...s }) => ({
      ...s,
      months: [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0],
      configured: intervals.filter((i) => i.scheme === s.scheme).map((i) => i.months),
    }))
    .sort((a, b) => a.chitValue - b.chitValue || a.months - b.months)
}

/**
 * The saved schedule for a scheme and duration, or a fresh draft built from
 * the scheme's groups when none has been saved yet.
 */
export async function getInterval(scheme: string, months?: number): Promise<ChitIntervalConfig | null> {
  const groups = await prisma.chitGroup.findMany({
    where: { percentage: scheme },
    select: { amount: true, totalTickets: true },
  })
  const saved = months
    ? await prisma.chitInterval.findUnique({
        where: { scheme_months: { scheme, months } },
        include: { rows: { orderBy: { monthNo: "asc" } }, updatedBy: { select: { name: true } } },
      })
    : null

  if (saved) {
    return {
      id: saved.id,
      scheme: saved.scheme,
      chitValue: saved.chitValue,
      months: saved.months,
      status: saved.status,
      notes: saved.notes ?? "",
      rows: saved.rows.map((r) => ({ monthNo: r.monthNo, installment: r.installment, payout: r.payout })),
      updatedAt: saved.updatedAt.toISOString(),
      updatedBy: saved.updatedBy?.name ?? null,
    }
  }

  if (groups.length === 0) return null

  const chitValue = groups[0].amount
  const duration = months ?? groups[0].totalTickets

  return {
    id: null,
    scheme,
    chitValue,
    months: duration,
    status: "active",
    notes: "",
    rows: blankRows(chitValue, duration),
    updatedAt: null,
    updatedBy: null,
  }
}

/**
 * Creates or replaces the schedule for (scheme, months). Keyed on that pair,
 * so saving the same scheme and duration again updates it rather than adding
 * a second schedule.
 */
export async function saveInterval(input: IntervalInput, userId: number) {
  const fields = {
    chitValue: input.chitValue,
    status: input.status,
    notes: input.notes || null,
    updatedById: userId,
  }

  await prisma.$transaction(async (tx) => {
    const interval = await tx.chitInterval.upsert({
      where: { scheme_months: { scheme: input.scheme, months: input.months } },
      create: { scheme: input.scheme, months: input.months, ...fields },
      update: fields,
      select: { id: true },
    })
    await tx.chitIntervalMonth.deleteMany({ where: { intervalId: interval.id } })
    await tx.chitIntervalMonth.createMany({
      data: input.rows.map((r) => ({
        intervalId: interval.id,
        monthNo: r.monthNo,
        installment: r.installment,
        payout: r.payout,
      })),
    })
  })
}

/**
 * The active schedule a group collects on: matched by plan code and duration.
 * Returns the instalment for each month, or null when no active schedule
 * covers the group.
 */
export async function activeScheduleFor(group: { percentage: string; totalTickets: number }) {
  const interval = await prisma.chitInterval.findUnique({
    where: { scheme_months: { scheme: group.percentage, months: group.totalTickets } },
    select: {
      id: true,
      scheme: true,
      status: true,
      rows: { select: { monthNo: true, installment: true } },
    },
  })
  if (!interval || interval.status !== "active") return null
  return {
    id: interval.id,
    scheme: interval.scheme,
    installment: new Map(interval.rows.map((r) => [r.monthNo, r.installment])),
  }
}
