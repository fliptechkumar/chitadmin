"use client"

import { useState } from "react"
import { Banknote, Coins, Loader2, Minus, Plus, RotateCcw } from "lucide-react"

import Modal from "./modal"
import { Button } from "@/components/ui/button"
import { Field, Textarea } from "@/components/ui/input"
import {
  COIN_THRESHOLD,
  DENOMINATIONS,
  denominationTotal,
  pieceCount,
  type Denomination,
  type DenominationCounts,
  type RouteSummary,
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

/**
 * Note-by-note cash count for one route. Totals update as the counts are
 * typed, so whoever is counting sees the difference against the receipts
 * before saving.
 */
export function DenominationTallyModal({
  open,
  route,
  date,
  onClose,
  onSaved,
}: {
  open: boolean
  route: RouteSummary | null
  date: string
  onClose: () => void
  onSaved: () => void
}) {
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [remarks, setRemarks] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  // Reset the form whenever a different route's count is opened.
  const openKey = open && route ? `${route.key}|${date}` : null
  if (openKey && openKey !== loadedKey) {
    setLoadedKey(openKey)
    setCounts(
      Object.fromEntries(
        Object.entries(route?.tally?.counts ?? {}).map(([k, v]) => [k, String(v)])
      )
    )
    setRemarks(route?.tally?.remarks ?? "")
    setError("")
  }
  if (!openKey && loadedKey) setLoadedKey(null)

  const parsed: DenominationCounts = Object.fromEntries(
    DENOMINATIONS.map((v) => [`${v}`, Math.max(0, Math.floor(Number(counts[`${v}`]) || 0))])
  )
  const counted = denominationTotal(parsed)
  const expected = route?.cash ?? 0
  const variance = counted - expected

  function setPieces(value: Denomination, next: string) {
    // Digits only — a count of notes is never negative or fractional.
    const clean = next.replace(/\D/g, "").slice(0, 6)
    setCounts((c) => ({ ...c, [`${value}`]: clean }))
  }

  function step(value: Denomination, delta: number) {
    const current = parsed[`${value}`] ?? 0
    setPieces(value, String(Math.max(0, current + delta)))
  }

  async function save() {
    if (!route) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/reports/denomination", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          branch: route.branch,
          routeId: route.routeId,
          counts: parsed,
          remarks,
        }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? "Could not save the count.")
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the count.")
    } finally {
      setSaving(false)
    }
  }

  const notes = DENOMINATIONS.filter((v) => v > COIN_THRESHOLD)
  const coins = DENOMINATIONS.filter((v) => v <= COIN_THRESHOLD)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={route ? `Cash count · ${route.code === "—" ? route.name : `${route.code} ${route.name}`}` : "Cash count"}
      description={
        route
          ? `${route.branch} · Expected cash ${inr(expected)} from ${route.receipts} receipt${route.receipts === 1 ? "" : "s"}`
          : undefined
      }
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            className="mr-auto"
            onClick={() => setCounts({})}
            disabled={saving || counted === 0}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save count
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {[
          { label: "Notes", values: notes },
          { label: "Coins", values: coins },
        ].map((section) => (
          <div key={section.label}>
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              {section.label}
            </p>
            <div className="overflow-hidden rounded-lg border border-border">
              {section.values.map((value) => {
                const pieces = parsed[`${value}`] ?? 0
                return (
                  <div
                    key={value}
                    className="flex items-center gap-3 border-b border-border/60 px-3 py-2 last:border-0"
                  >
                    <FaceValue value={value} />
                    <span className="text-xs text-muted-foreground">×</span>
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`One fewer ₹${value}`}
                        onClick={() => step(value, -1)}
                        disabled={pieces === 0}
                      >
                        <Minus />
                      </Button>
                      <input
                        inputMode="numeric"
                        aria-label={`Number of ₹${value}`}
                        value={counts[`${value}`] ?? ""}
                        placeholder="0"
                        onChange={(e) => setPieces(value, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="tnum h-8 w-20 rounded-md border border-input bg-surface-2 text-center text-sm font-semibold text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/50 focus:border-brand focus:bg-card focus:ring-4 focus:ring-brand/12"
                      />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`One more ₹${value}`}
                        onClick={() => step(value, 1)}
                      >
                        <Plus />
                      </Button>
                    </div>
                    <span
                      className={cn(
                        "tnum ml-auto text-sm font-semibold",
                        pieces ? "text-foreground" : "text-muted-foreground/50"
                      )}
                    >
                      {inr(value * pieces)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
          <div className="bg-surface-2 p-3">
            <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Counted
            </p>
            <p className="tnum mt-0.5 text-lg font-bold text-foreground">{inr(counted)}</p>
            <p className="tnum text-2xs text-muted-foreground">
              {pieceCount(parsed).toLocaleString("en-IN")} pieces
            </p>
          </div>
          <div className="bg-surface-2 p-3">
            <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cash receipts
            </p>
            <p className="tnum mt-0.5 text-lg font-bold text-foreground">{inr(expected)}</p>
          </div>
          <div
            className={cn(
              "p-3",
              variance === 0
                ? "bg-success-soft"
                : variance < 0
                  ? "bg-danger-soft"
                  : "bg-warning-soft"
            )}
          >
            <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Difference
            </p>
            <p className="tnum mt-0.5 text-lg">
              <VarianceText variance={variance} />
            </p>
          </div>
        </div>

        <Field label="Remarks" hint="Explain any shortage or excess for the record.">
          <Textarea
            rows={2}
            maxLength={500}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. ₹200 short — member to pay balance tomorrow"
          />
        </Field>

        {error && (
          <p className="animate-fade-in rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger-soft-foreground">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
