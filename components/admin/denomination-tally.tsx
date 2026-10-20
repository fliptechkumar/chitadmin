import { Banknote, Coins } from "lucide-react"

import {
  COIN_THRESHOLD,
  DENOMINATIONS,
  type Denomination,
  type DenominationCounts,
} from "@/lib/denomination"
import { inr } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Variance line shared by the editor and the read-only breakdown. */
export function VarianceText({ variance }: { variance: number }) {
  if (variance === 0) {
    return <span className="font-semibold text-success-soft-foreground">Tallied</span>
  }
  return (
    <span
      className={cn(
        "font-semibold",
        variance < 0 ? "text-danger-soft-foreground" : "text-warning-soft-foreground"
      )}
    >
      {variance < 0 ? "Short" : "Excess"} {inr(Math.abs(variance))}
    </span>
  )
}

/** Read-only note breakdown, used when several routes are summed together. */
export function DenominationBreakdown({ counts }: { counts: DenominationCounts }) {
  const used = DENOMINATIONS.filter((v) => (counts[`${v}`] ?? 0) > 0)

  if (used.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        No cash has been counted for this selection yet.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border/60">
      {used.map((value) => {
        const pieces = counts[`${value}`] ?? 0
        return (
          <li key={value} className="flex items-center gap-3 py-2 text-sm">
            <FaceValue value={value} />
            <span className="tnum text-muted-foreground">× {pieces.toLocaleString("en-IN")}</span>
            <span className="tnum ml-auto font-semibold text-foreground">
              {inr(value * pieces)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function FaceValue({ value }: { value: Denomination }) {
  const coin = value <= COIN_THRESHOLD
  return (
    <span
      className={cn(
        "tnum inline-flex h-7 w-16 shrink-0 items-center justify-center gap-1 text-xs font-bold",
        coin
          ? "rounded-full bg-warning-soft text-warning-soft-foreground"
          : "rounded-md border border-success/25 bg-success-soft text-success-soft-foreground"
      )}
    >
      {coin ? <Coins className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}₹{value}
    </span>
  )
}
