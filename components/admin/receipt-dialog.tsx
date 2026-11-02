"use client"

import { useEffect, useState } from "react"
import { Printer } from "lucide-react"

import Modal from "./modal"
import { Badge, toneFor } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { ReceiptDetail } from "@/lib/collection-register"
import { inr } from "@/lib/format"

const MODE_LABEL: Record<string, string> = { cash: "Cash", online: "Online", cheque: "Cheque" }

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  })

/** The lines of a receipt, shared by the dialog and the printed slip. */
function linesOf(r: ReceiptDetail): [string, string][] {
  const lines: [string, string | null][] = [
    ["Receipt no", r.receiptNo],
    ["Date & time", `${r.date}, ${timeOf(r.createdAt)}`],
    ["Member", r.name],
    ["Account no", r.accountNo || null],
    ["Mobile", r.mobile || null],
    ["Group / Ticket", `${r.group} / ${r.ticketNo ?? "—"}`],
    ["Instalment", `From month ${r.installment}`],
    ["Reference", r.reference || null],
    ["Note", r.note || null],
    ["Monthly due", inr(r.monthlyDue)],
    ["Balance now", inr(r.balance)],
    ["Route", r.route ? `${r.route.code} ${r.route.name}` : null],
    ["Branch", r.route?.branch ?? null],
  ]
  return lines.filter((l): l is [string, string] => l[1] !== null)
}

const esc = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Opens a slip in its own window, as the phone prints it, without the admin chrome. */
function printReceipt(r: ReceiptDetail) {
  const win = window.open("", "_blank", "width=420,height=640")
  if (!win) return false

  const rows = linesOf(r)
    .map(([k, v]) => `<tr><td class="m">${esc(k)}</td><td class="r b">${esc(v)}</td></tr>`)
    .join("")

  win.document.open()
  win.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>${esc(r.receiptNo)}</title>
<style>
  @page { margin: 6mm; }
  body { font-family: Arial, sans-serif; color: #101828; font-size: 12px; max-width: 76mm; margin: 0 auto; }
  h1 { font-size: 15px; margin: 0; text-align: center; }
  .c { text-align: center; } .m { color: #667085; } .b { font-weight: 700; }
  .amt { font-size: 22px; font-weight: 800; text-align: center; margin: 8px 0 2px; }
  hr { border: 0; border-top: 1px dashed #98A2B3; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 0; vertical-align: top; } td.r { text-align: right; }
</style></head><body>
<h1>${esc(r.company.name)}</h1>
<div class="c m">${esc(r.company.address)}</div>
${r.company.phone ? `<div class="c m">Ph: ${esc(r.company.phone)}</div>` : ""}
<hr><div class="c b">PAYMENT RECEIPT</div>
<div class="amt">${esc(inr(r.amount))}</div>
<div class="c m">${esc(MODE_LABEL[r.mode] ?? r.mode)}</div>
<hr><table>${rows}</table><hr>
<div class="c m">Collected by ${esc(r.collectedBy)}</div>
<div class="c m">Thank you</div>
<script>window.onload = () => { window.focus(); window.print(); }</script>
</body></html>`)
  win.document.close()
  return true
}

/** One receipt in full, opened from the register. Null `id` means closed. */
export default function ReceiptDialog({
  id,
  onClose,
}: {
  id: number | null
  onClose: () => void
}) {
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null)
  const [error, setError] = useState("")
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    if (id === null) return
    const controller = new AbortController()

    async function load() {
      try {
        const response = await fetch(`/api/collections/${id}`, { signal: controller.signal })
        const body = (await response.json().catch(() => null)) as
          | (ReceiptDetail & { error?: string })
          | null
        if (!response.ok || !body) throw new Error(body?.error ?? "Could not load the receipt.")
        setReceipt(body)
        setError("")
      } catch (e) {
        if (controller.signal.aborted) return
        setReceipt(null)
        setError(e instanceof Error ? e.message : "Could not load the receipt.")
      }
    }

    void load()
    return () => controller.abort()
  }, [id])

  function close() {
    setBlocked(false)
    onClose()
  }

  // The last receipt stays in state, so wait for the one that was asked for.
  const shown = receipt && (receipt.id === id || id === null) ? receipt : null

  return (
    <Modal
      open={id !== null}
      onClose={close}
      size="sm"
      title={shown ? shown.receiptNo : "Receipt"}
      description={shown?.company.name}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={close}>
            Close
          </Button>
          <Button
            size="sm"
            disabled={!shown}
            onClick={() => shown && setBlocked(!printReceipt(shown))}
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
        </>
      }
    >
      {error ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{error}</p>
      ) : !shown ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-6" />
          ))}
        </div>
      ) : (
        <>
          <div className="pb-4 text-center">
            <p className="text-xs text-muted-foreground">Amount paid</p>
            <p className="tnum mt-1 text-2xl font-bold text-foreground">{inr(shown.amount)}</p>
            <Badge tone={toneFor(shown.mode)} className="mt-2">
              {MODE_LABEL[shown.mode] ?? shown.mode}
            </Badge>
          </div>
          <dl className="divide-y divide-border border-t border-dashed border-border text-sm">
            {linesOf(shown).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2">
                <dt className="shrink-0 text-muted-foreground">{k}</dt>
                <dd className="tnum min-w-0 break-words text-right font-medium text-foreground">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Collected by {shown.collectedBy}
          </p>
          {blocked && (
            <p className="mt-2 text-center text-xs text-danger-soft-foreground">
              The browser blocked the print window. Allow pop-ups for this site and try again.
            </p>
          )}
        </>
      )}
    </Modal>
  )
}
