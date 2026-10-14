"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Calculator,
  ClipboardPaste,
  Loader2,
  RotateCcw,
  Save,
  Undo2,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { Input, Textarea } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import {
  DEFAULT_COMMISSION_PCT,
  blankRows,
  kasarFromPayout,
  parseInterval,
  shareOf,
  withTotals,
  type ChitIntervalConfig,
  type IntervalErrors,
  type IntervalStatus,
  type SchemeOption,
} from "@/lib/chit-interval"
import { inr } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Editable row, held as the strings the inputs produce. */
type DraftRow = { installment: string; payout: string }

type Draft = {
  months: string
  status: IntervalStatus
  notes: string
  rows: DraftRow[]
}

const NO_ERRORS: IntervalErrors = { form: {}, rows: {} }

const cellInput =
  "tnum h-8 w-full rounded-md border border-input bg-surface-2 pl-5 pr-2 text-right text-sm text-foreground outline-none transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground/60 hover:border-border focus:border-brand focus:bg-card focus:ring-4 focus:ring-brand/12"

const digits = (value: string) => value.replace(/[^\d]/g, "").slice(0, 9)
const num = (value: string) => (value.trim() === "" ? 0 : Number(value))

function toDraft(c: ChitIntervalConfig): Draft {
  return {
    months: String(c.months),
    status: c.status,
    notes: c.notes,
    rows: c.rows.map((r) => ({
      installment: String(r.installment),
      payout: r.payout === null ? "" : String(r.payout),
    })),
  }
}

export default function ChitIntervalEditor({ schemes: initialSchemes }: { schemes: SchemeOption[] }) {
  const [schemes, setSchemes] = useState(initialSchemes)
  const [scheme, setScheme] = useState("")
  const [config, setConfig] = useState<ChitIntervalConfig | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<IntervalErrors>(NO_ERRORS)
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  const [commission, setCommission] = useState(String(DEFAULT_COMMISSION_PCT))

  const original = useMemo(() => (config ? toDraft(config) : null), [config])
  const dirty = Boolean(draft && original && JSON.stringify(draft) !== JSON.stringify(original))

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  useEffect(() => {
    if (message?.tone !== "success") return
    const timer = setTimeout(() => setMessage(null), 5000)
    return () => clearTimeout(timer)
  }, [message])

  const schemeOptions = useMemo<ComboboxOption[]>(
    () =>
      schemes.map((s) => ({
        value: s.scheme,
        label: s.scheme,
        hint: `${inr(s.chitValue)} · ${s.months} mo${s.configured.length ? " · ✓" : ""}`,
        keywords: `${s.chitValue} ${s.groups} groups`,
      })),
    [schemes]
  )

  async function load(nextScheme: string, months?: number) {
    setLoading(true)
    setErrors(NO_ERRORS)
    setMessage(null)
    try {
      const params = new URLSearchParams({ scheme: nextScheme })
      if (months) params.set("months", String(months))
      const response = await fetch(`/api/chit-intervals?${params}`)
      // A crashed request can come back empty; read it without throwing.
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? `Could not load the scheme (server error ${response.status}).`)
      setConfig(body as ChitIntervalConfig)
      setDraft(toDraft(body as ChitIntervalConfig))
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not load the scheme." })
    } finally {
      setLoading(false)
    }
  }

  function pickScheme(value: string) {
    if (value === scheme) return
    if (dirty && !window.confirm("You have unsaved changes. Discard them?")) return
    setScheme(value)
    const option = schemes.find((s) => s.scheme === value)
    if (option) void load(value, option.months)
  }

  /** A new duration is a different schedule: load it if saved, else start one. */
  function changeMonths(value: string) {
    if (!draft || !config) return
    const clean = value.replace(/[^\d]/g, "").slice(0, 3)
    setDraft({ ...draft, months: clean })
    const months = Number(clean)
    if (!Number.isInteger(months) || months < 2 || months > 120 || months === config.months) return
    if (dirty && !window.confirm(`Switch to a ${months}-month schedule? Unsaved changes will be lost.`)) {
      setDraft({ ...draft })
      return
    }
    void load(scheme, months)
  }

  function setRow(index: number, patch: Partial<DraftRow>) {
    if (!draft) return
    setDraft({ ...draft, rows: draft.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) })
    if (errors.rows[index + 1]) {
      const rows = { ...errors.rows }
      delete rows[index + 1]
      setErrors({ ...errors, rows })
    }
  }

  /**
   * Pasting a column copied from Excel fills downwards from the cell, so a
   * printed schedule can be keyed in once rather than twenty times.
   */
  function pasteColumn(index: number, field: "installment" | "kasar" | "payout", e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text")
    const values = text.split(/\r?\n/).map((v) => v.trim()).filter((v, i, all) => v || i < all.length - 1)
    if (!draft || !config || values.length < 2) return
    e.preventDefault()
    const share = shareOf(config.chitValue, config.months)
    setDraft({
      ...draft,
      rows: draft.rows.map((r, i) => {
        const v = values[i - index]
        if (i < index || v === undefined) return r
        const n = digits(v)
        if (field === "installment") return { ...r, installment: n }
        if (field === "kasar") return { ...r, installment: n === "" ? r.installment : String(Math.max(0, share - Number(n))) }
        return { ...r, payout: n }
      }),
    })
    setMessage({ tone: "success", text: `Pasted ${Math.min(values.length, draft.rows.length - index)} values.` })
  }

  function calculateFromPayouts() {
    if (!draft || !config) return
    const pct = Number(commission)
    if (!Number.isFinite(pct) || pct < 0 || pct > 50) {
      setMessage({ tone: "error", text: "Commission must be between 0 and 50%." })
      return
    }
    const share = shareOf(config.chitValue, config.months)
    setDraft({
      ...draft,
      rows: draft.rows.map((r) =>
        r.payout
          ? { ...r, installment: String(share - Math.min(share, kasarFromPayout(config.chitValue, config.months, Number(r.payout), pct))) }
          : r
      ),
    })
    setMessage({
      tone: "success",
      text: `Instalments recalculated from payouts with ${pct}% commission. Review rows where the printed schedule differs.`,
    })
  }

  async function save() {
    if (!draft || !config) return
    const payload = {
      scheme: config.scheme,
      chitValue: config.chitValue,
      months: Number(draft.months),
      status: draft.status,
      notes: draft.notes,
      rows: draft.rows.map((r) => ({
        installment: num(r.installment),
        payout: r.payout.trim() === "" ? null : Number(r.payout),
      })),
    }

    const checked = parseInterval(payload)
    if (!checked.ok) {
      setErrors(checked.errors)
      setMessage({ tone: "error", text: "Fix the highlighted fields before saving." })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch("/api/chit-intervals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        if (body?.errors) setErrors(body.errors as IntervalErrors)
        throw new Error(body?.error ?? "Could not save the schedule.")
      }
      const fresh = body as ChitIntervalConfig
      setConfig(fresh)
      setDraft(toDraft(fresh))
      setErrors(NO_ERRORS)
      setSchemes((list) =>
        list.map((s) =>
          s.scheme === fresh.scheme && !s.configured.includes(fresh.months)
            ? { ...s, configured: [...s.configured, fresh.months] }
            : s
        )
      )
      setMessage({ tone: "success", text: `Saved the ${fresh.months}-month schedule for ${fresh.scheme}.` })
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not save the schedule." })
    } finally {
      setSaving(false)
    }
  }

  const option = schemes.find((s) => s.scheme === scheme)
  const share = config ? shareOf(config.chitValue, config.months) : 0
  const totals = useMemo(() => {
    if (!draft || !config) return null
    return withTotals(
      draft.rows.map((r, i) => ({
        monthNo: i + 1,
        installment: num(r.installment),
        payout: r.payout ? Number(r.payout) : null,
      })),
      config.chitValue,
      config.months
    )
  }, [draft, config])

  const changedRows =
    draft && original
      ? draft.rows.filter((r, i) => JSON.stringify(r) !== JSON.stringify(original.rows[i])).length
      : 0
  const durationMismatch = option && config && config.months !== option.months

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="reveal flex items-center gap-3" style={{ "--i": 0 } as React.CSSProperties}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
          <CalendarClock className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Chit interval</h2>
          <p className="text-sm text-muted-foreground">
            Set what every member pays each month of a scheme. Customer records use this schedule.
          </p>
        </div>
      </div>

      {message && (
        <div
          role={message.tone === "error" ? "alert" : "status"}
          className={cn(
            "animate-scale-in flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
            message.tone === "success" ? "bg-success-soft text-success-soft-foreground" : "bg-danger-soft text-danger-soft-foreground"
          )}
        >
          {message.tone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="flex-1">{message.text}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setMessage(null)} className="opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Configuration */}
      <Card className="reveal" style={{ "--i": 1 } as React.CSSProperties}>
        <CardHeader>
          <div>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              {config?.id
                ? `Saved${config.updatedBy ? ` by ${config.updatedBy}` : ""} · ${new Date(config.updatedAt!).toLocaleString("en-IN")}`
                : config
                  ? "Not saved yet — a draft at the full monthly share"
                  : "Choose a scheme to configure its schedule"}
            </CardDescription>
          </div>
          {config && (
            <Badge tone={config.id ? (config.status === "active" ? "success" : "neutral") : "warning"} size="md">
              {config.id ? config.status : "draft"}
            </Badge>
          )}
        </CardHeader>
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="Chit scheme" className="sm:col-span-2" error={errors.form.scheme}>
            <Combobox
              value={scheme}
              onChange={pickScheme}
              options={schemeOptions}
              placeholder="Choose a scheme…"
              searchPlaceholder="Search scheme or amount…"
              aria-label="Chit scheme"
            />
          </Field>
          <Field label="Chit amount" error={errors.form.chitValue}>
            <ReadOnly value={config ? inr(config.chitValue) : "—"} />
          </Field>
          <Field
            label="Duration (months)"
            error={errors.form.months}
            hint={durationMismatch ? `Groups run ${option?.months} months` : undefined}
          >
            <Input
              inputMode="numeric"
              value={draft?.months ?? ""}
              onChange={(e) => changeMonths(e.target.value)}
              disabled={!draft || loading}
              className="tnum"
              aria-label="Duration in months"
            />
          </Field>
          <Field label="Status" error={errors.form.status}>
            <div className="flex h-9 rounded-lg bg-muted p-1">
              {(["active", "inactive"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!draft}
                  onClick={() => draft && setDraft({ ...draft, status: s })}
                  className={cn(
                    "press flex-1 rounded-md text-xs font-semibold capitalize transition-colors disabled:opacity-50",
                    draft?.status === s
                      ? s === "active"
                        ? "bg-card text-success-soft-foreground shadow-sm"
                        : "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>
          {draft && (
            <Field label="Notes" className="sm:col-span-2 xl:col-span-5">
              <Textarea
                rows={1}
                maxLength={500}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="e.g. As per the printed card issued Jan 2024"
              />
            </Field>
          )}
        </div>
      </Card>

      {loading ? (
        <Card className="space-y-2 p-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </Card>
      ) : !draft || !config || !totals ? (
        <SchemeGrid schemes={schemes} onPick={pickScheme} />
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Figure label="Monthly share" value={inr(share)} caption={`${inr(config.chitValue)} ÷ ${config.months}`} />
            <Figure label="Member pays in total" value={inr(totals.payable)} tone="text-brand" caption="Sum of instalments" />
            <Figure label="Total kasar" value={inr(totals.kasarTotal)} tone="text-success-soft-foreground" caption="Dividend back to each member" />
            <Figure label="Lowest instalment" value={inr(Math.min(...totals.rows.map((r) => r.installment)))} />
            <Figure label="Groups on scheme" value={String(option?.groups ?? 0)} caption={option ? `${option.months}-month groups use this` : undefined} />
          </div>

          {/* Schedule */}
          <Card className="reveal overflow-hidden" style={{ "--i": 2 } as React.CSSProperties}>
            <CardHeader className="flex-col items-stretch gap-3 lg:flex-row lg:items-center">
              <div>
                <CardTitle>Monthly schedule</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <ClipboardPaste className="h-3 w-3" />
                  Paste a column from Excel into any cell to fill downwards.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 py-1 pl-2.5 pr-1">
                  <span className="text-xs text-muted-foreground">Commission</span>
                  <input
                    inputMode="decimal"
                    value={commission}
                    onChange={(e) => setCommission(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))}
                    className="tnum h-6 w-10 rounded border border-input bg-card px-1 text-center text-xs outline-none focus:border-brand"
                    aria-label="Commission percent"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                  <Button variant="outline" size="xs" onClick={calculateFromPayouts} title="Instalment = share − (chit − payout − commission) ÷ months">
                    <Calculator />
                    From payouts
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      rows: blankRows(config.chitValue, config.months).map((r) => ({
                        installment: String(r.installment),
                        payout: r.payout === null ? "" : String(r.payout),
                      })),
                    })
                  }
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset to full share
                </Button>
              </div>
            </CardHeader>

            <TableWrap>
              <Table className="min-w-[760px]">
                <THead>
                  <tr>
                    <TH className="w-14">Month</TH>
                    <TH className="w-[150px] text-right">Instalment</TH>
                    <TH className="w-[130px] text-right">Kasar</TH>
                    <TH className="w-[160px] text-right">Payout</TH>
                    <TH className="text-right">Paid so far</TH>
                    <TH className="text-right">Remaining</TH>
                  </tr>
                </THead>
                <TBody key={`${config.scheme}-${config.months}`}>
                  {totals.rows.map((r, i) => {
                    const d = draft.rows[i]
                    const err = errors.rows[r.monthNo]
                    const changed = original && JSON.stringify(d) !== JSON.stringify(original.rows[i])
                    return (
                      <TR
                        key={r.monthNo}
                        index={Math.min(i, 14)}
                        className={cn(err && "bg-danger-soft/40", !err && changed && "bg-brand-soft/40")}
                      >
                        <TD className="tnum font-semibold text-foreground">{r.monthNo}</TD>
                        <TD>
                          <Money
                            value={d.installment}
                            onChange={(v) => setRow(i, { installment: v })}
                            onPaste={(e) => pasteColumn(i, "installment", e)}
                            label={`Instalment, month ${r.monthNo}`}
                            invalid={Boolean(err?.installment)}
                            strong
                          />
                          {err?.installment && <p className="mt-1 text-2xs font-medium text-danger">{err.installment}</p>}
                        </TD>
                        <TD>
                          <Money
                            value={d.installment === "" ? "" : String(Math.max(0, share - num(d.installment)))}
                            onChange={(v) => setRow(i, { installment: v === "" ? "" : String(Math.max(0, share - Number(v))) })}
                            onPaste={(e) => pasteColumn(i, "kasar", e)}
                            label={`Kasar, month ${r.monthNo}`}
                            placeholder="—"
                          />
                        </TD>
                        <TD>
                          <Money
                            value={d.payout}
                            onChange={(v) => setRow(i, { payout: v })}
                            onPaste={(e) => pasteColumn(i, "payout", e)}
                            label={`Payout, month ${r.monthNo}`}
                            invalid={Boolean(err?.payout)}
                            placeholder="Registration"
                          />
                          {err?.payout && <p className="mt-1 text-2xs font-medium text-danger">{err.payout}</p>}
                        </TD>
                        <TD className="tnum whitespace-nowrap text-right font-medium text-foreground">{inr(r.cumulative)}</TD>
                        <TD className="tnum whitespace-nowrap text-right">{r.remaining ? inr(r.remaining) : <Badge tone="success">Complete</Badge>}</TD>
                      </TR>
                    )
                  })}
                </TBody>
                <tfoot className="border-t border-border bg-surface-2 text-sm">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-foreground">Total</td>
                    <td className="tnum px-4 py-3 text-right font-bold text-foreground">{inr(totals.payable)}</td>
                    <td className="tnum px-4 py-3 text-right font-bold text-success-soft-foreground">{inr(totals.kasarTotal)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </Table>
            </TableWrap>
          </Card>

          {/* Save bar */}
          <div className="sticky bottom-4 z-20">
            <div className={cn("flex flex-wrap items-center gap-3 rounded-xl border bg-card/95 px-4 py-3 shadow-lg backdrop-blur", dirty ? "border-brand/40" : "border-border")}>
              <p className="text-sm text-muted-foreground">
                {dirty
                  ? changedRows
                    ? `${changedRows} month${changedRows === 1 ? "" : "s"} changed — not saved yet`
                    : "Settings changed — not saved yet"
                  : config.id
                    ? "All changes saved."
                    : "This schedule has not been saved yet."}
              </p>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!dirty || saving}
                  onClick={() => {
                    if (original) setDraft(original)
                    setErrors(NO_ERRORS)
                  }}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Discard
                </Button>
                <Button size="sm" onClick={() => void save()} disabled={saving || (!dirty && Boolean(config.id))}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save schedule
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string
  error?: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
      {error ? (
        <p className="text-2xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-2xs font-medium text-warning-soft-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

function ReadOnly({ value }: { value: string }) {
  return (
    <div className="tnum flex h-9 items-center rounded-lg border border-dashed border-border px-3 text-sm font-semibold text-foreground">
      {value}
    </div>
  )
}

function Money({
  value,
  onChange,
  onPaste,
  label,
  invalid = false,
  strong = false,
  placeholder = "0",
}: {
  value: string
  onChange: (value: string) => void
  onPaste: (e: React.ClipboardEvent) => void
  label: string
  invalid?: boolean
  strong?: boolean
  placeholder?: string
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
      <input
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(digits(e.target.value))}
        onPaste={onPaste}
        onFocus={(e) => e.target.select()}
        aria-label={label}
        aria-invalid={invalid}
        className={cn(cellInput, strong && "font-semibold", invalid && "border-danger focus:border-danger focus:ring-danger/15")}
      />
    </div>
  )
}

function Figure({ label, value, caption, tone }: { label: string; value: string; caption?: string; tone?: string }) {
  return (
    <Card className="p-4">
      <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("tnum mt-1 text-xl font-bold tracking-tight", tone ?? "text-foreground")}>{value}</p>
      {caption && <p className="mt-0.5 truncate text-xs text-muted-foreground">{caption}</p>}
    </Card>
  )
}

function SchemeGrid({ schemes, onPick }: { schemes: SchemeOption[]; onPick: (scheme: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-medium text-muted-foreground">Schemes in use across your groups</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {schemes.map((s, i) => {
          const done = s.configured.includes(s.months)
          return (
            <Card key={s.scheme} interactive className="reveal p-0" style={{ "--i": Math.min(i + 2, 12) } as React.CSSProperties}>
              <button type="button" onClick={() => onPick(s.scheme)} className="group w-full p-4 text-left">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{s.scheme}</p>
                    <p className="tnum text-lg font-bold tracking-tight text-brand">{inr(s.chitValue)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="tnum">
                    {s.months} months · {s.groups} group{s.groups === 1 ? "" : "s"}
                  </span>
                  {done ? (
                    <Badge tone="success">
                      <CheckCircle2 className="h-3 w-3" />
                      Configured
                    </Badge>
                  ) : (
                    <Badge tone="warning">Not set</Badge>
                  )}
                </div>
              </button>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
