import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

import type { DayStatement, Receipt } from '@/api/types'
import { dLong, inr, MODE_LABEL, timeOf, titleCase } from './format'

/**
 * Receipts and the day statement as small HTML pages, printed through the
 * phone's print service (which also reaches Bluetooth receipt printers that
 * ship a print plugin) or saved as a PDF and shared, e.g. on WhatsApp.
 */

const esc = (s: string | number) =>
  String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)

const page = (body: string) => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page { margin: 6mm; }
  body { font-family: -apple-system, Roboto, 'Helvetica Neue', Arial, sans-serif; color: #101828; font-size: 12px; max-width: 76mm; margin: 0 auto; }
  h1 { font-size: 15px; margin: 0; text-align: center; }
  .c { text-align: center; } .m { color: #667085; } .b { font-weight: 700; }
  .amt { font-size: 22px; font-weight: 800; text-align: center; margin: 8px 0 2px; }
  hr { border: 0; border-top: 1px dashed #98A2B3; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 0; vertical-align: top; } td.r { text-align: right; }
  .tot td { border-top: 1px solid #101828; font-weight: 700; padding-top: 6px; }
</style></head><body>${body}</body></html>`

const row = (k: string, v: string) => `<tr><td class="m">${esc(k)}</td><td class="r b">${esc(v)}</td></tr>`

export function receiptHtml(r: Receipt, applied?: { installmentNo: number; amount: number }[]) {
  const months = applied?.length
    ? applied.map((a) => `#${a.installmentNo} ${inr(a.amount)}`).join(', ')
    : `From #${r.installment}`
  return page(`
    <h1>${esc(r.company.name)}</h1>
    <div class="c m">${esc(r.company.address)}</div>
    ${r.company.phone ? `<div class="c m">Ph: ${esc(r.company.phone)}</div>` : ''}
    <hr><div class="c b">PAYMENT RECEIPT</div>
    <div class="amt">${esc(inr(r.amount))}</div>
    <div class="c m">${esc(MODE_LABEL[r.mode] ?? r.mode)}${r.reference ? ` · Ref ${esc(r.reference)}` : ''}</div>
    <hr><table>
      ${row('Receipt no', r.receiptNo)}
      ${row('Date', `${dLong(r.date)}, ${timeOf(r.createdAt)}`)}
      ${row('Member', titleCase(r.name))}
      ${r.accountNo ? row('Account no', r.accountNo) : ''}
      ${row('Group / Ticket', `${r.group} / ${r.ticketNo ?? '—'}`)}
      ${row('Instalment', months)}
      ${row('Monthly due', inr(r.monthlyDue))}
      ${row('Balance pending', inr(r.balance))}
      ${r.route ? row('Route', `${r.route.code} ${r.route.name}`) : ''}
    </table><hr>
    <div class="c m">Collected by ${esc(r.collectedBy)}</div>
    <div class="c m">Thank you</div>`)
}

export function statementHtml(s: DayStatement, header: { company: string; route: string; collector: string }) {
  const lines = s.rows
    .map(
      (r, i) =>
        `<tr><td>${i + 1}. ${esc(titleCase(r.name))}<br><span class="m">${esc(r.group)}/${esc(r.ticketNo ?? '—')} · ${esc(r.receiptNo)} · ${esc(MODE_LABEL[r.mode] ?? r.mode)}</span></td><td class="r b">${esc(inr(r.amount))}</td></tr>`,
    )
    .join('')
  return page(`
    <h1>${esc(header.company)}</h1>
    <div class="c b">DAY STATEMENT</div>
    <div class="c m">${esc(dLong(s.date))} · ${esc(header.route)}</div>
    <hr><table>${lines || '<tr><td class="m">No collections</td></tr>'}
      <tr class="tot"><td>Total (${s.totals.receipts})</td><td class="r">${esc(inr(s.totals.total))}</td></tr>
    </table><hr><table>
      ${row('Cash', inr(s.totals.cash))}
      ${row('Online', inr(s.totals.online))}
      ${row('Cheque', inr(s.totals.cheque))}
    </table><hr><div class="c m">${esc(header.collector)}</div>`)
}

export async function printHtml(html: string) {
  await Print.printAsync({ html })
}

export async function shareHtmlAsPdf(html: string, title: string) {
  const { uri } = await Print.printToFileAsync({ html, width: 288 })
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this phone.')
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title })
}
