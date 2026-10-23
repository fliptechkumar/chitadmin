import { Buffer } from 'buffer'

import type { DayStatement, Receipt } from '@/api/types'
import { dLong, inr, MODE_LABEL, timeOf, titleCase } from './format'

/**
 * Receipts as raw ESC/POS bytes for 58mm Bluetooth thermal printers, which
 * print plain text in their built-in font rather than rendering HTML.
 *
 * 58mm paper holds 32 characters a line in the normal font. The printers'
 * code pages have no rupee sign, so amounts are written "Rs.".
 */

const WIDTH = 32

const ESC = 0x1b
const GS = 0x1d

/** Text the printer's code page can show: rupee → "Rs.", other non-ASCII dropped. */
const plain = (s: string) =>
  s
    .replace(/₹/g, 'Rs.')
    .replace(/[–—]/g, '-')
    .replace(/[·•]/g, '-')
    .replace(/[^\x20-\x7e]/g, '')

const money = (n: number | null | undefined) => plain(inr(n))

/** Breaks text into lines of at most `width`, on spaces where it can. */
function wrap(text: string, width = WIDTH): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of plain(text).split(/\s+/).filter(Boolean)) {
    if (word.length > width) {
      if (line) lines.push(line)
      for (let i = 0; i < word.length; i += width) lines.push(word.slice(i, i + width))
      line = lines.pop() ?? ''
      continue
    }
    if (!line) line = word
    else if (line.length + 1 + word.length <= width) line += ` ${word}`
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

class Doc {
  private parts: Buffer[] = [Buffer.from([ESC, 0x40])]

  private raw(...bytes: number[]) {
    this.parts.push(Buffer.from(bytes))
    return this
  }

  align(a: 'left' | 'center' | 'right') {
    return this.raw(ESC, 0x61, a === 'left' ? 0 : a === 'center' ? 1 : 2)
  }

  bold(on: boolean) {
    return this.raw(ESC, 0x45, on ? 1 : 0)
  }

  /** Character size: 1 = normal, 2 = double width and height. */
  size(n: 1 | 2) {
    return this.raw(GS, 0x21, n === 2 ? 0x11 : 0x00)
  }

  text(s: string, width = WIDTH) {
    for (const line of wrap(s, width)) this.parts.push(Buffer.from(`${line}\n`, 'latin1'))
    return this
  }

  /** Label on the left, value on the right; the value drops a line when both don't fit. */
  pair(label: string, value: string) {
    const l = plain(label)
    const v = plain(value)
    if (l.length + 1 + v.length <= WIDTH) {
      this.parts.push(Buffer.from(`${l}${' '.repeat(WIDTH - l.length - v.length)}${v}\n`, 'latin1'))
    } else {
      this.text(l)
      for (const line of wrap(v)) this.parts.push(Buffer.from(`${line.padStart(WIDTH)}\n`, 'latin1'))
    }
    return this
  }

  rule() {
    return this.text('-'.repeat(WIDTH))
  }

  /** Blank lines so the last printed line clears the tear bar. */
  feed(lines = 3) {
    return this.raw(ESC, 0x64, lines)
  }

  build() {
    return Buffer.concat(this.parts)
  }
}

export function receiptEscPos(r: Receipt, applied?: { installmentNo: number; amount: number }[]) {
  const months = applied?.length
    ? applied.map((a) => `#${a.installmentNo} ${money(a.amount)}`).join(', ')
    : `From #${r.installment}`

  const d = new Doc().align('center').bold(true).text(r.company.name).bold(false)
  if (r.company.address) d.text(r.company.address)
  if (r.company.phone) d.text(`Ph: ${r.company.phone}`)
  d.rule()
    .bold(true)
    .text('PAYMENT RECEIPT')
    .size(2)
    .text(money(r.amount), WIDTH / 2)
    .size(1)
    .bold(false)
    .text(`${MODE_LABEL[r.mode] ?? r.mode}${r.reference ? ` - Ref ${r.reference}` : ''}`)
    .rule()
    .align('left')
    .pair('Receipt no', r.receiptNo)
    .pair('Date', `${dLong(r.date)}, ${timeOf(r.createdAt)}`)
    .pair('Member', titleCase(r.name))
  if (r.accountNo) d.pair('Account no', r.accountNo)
  d.pair('Group/Ticket', `${r.group} / ${r.ticketNo ?? '-'}`).pair('Instalment', months)
  if (r.note) d.pair('Note', r.note)
  d.pair('Monthly due', money(r.monthlyDue)).bold(true).pair('Balance pending', money(r.balance)).bold(false)
  if (r.route) d.pair('Route', `${r.route.code} ${r.route.name}`)
  return d
    .rule()
    .align('center')
    .text(`Collected by ${r.collectedBy}`)
    .text('Thank you')
    .feed()
    .build()
}

export function statementEscPos(s: DayStatement, header: { company: string; route: string; collector: string }) {
  const d = new Doc()
    .align('center')
    .bold(true)
    .text(header.company)
    .text('DAY STATEMENT')
    .bold(false)
    .text(`${dLong(s.date)} - ${header.route}`)
    .rule()
    .align('left')

  if (!s.rows.length) d.text('No collections')
  s.rows.forEach((r, i) => {
    const amount = money(r.amount)
    d.pair(`${i + 1}. ${titleCase(r.name)}`.slice(0, WIDTH - amount.length - 1).trim(), amount).text(
      `${r.group}/${r.ticketNo ?? '-'} ${r.receiptNo} ${MODE_LABEL[r.mode] ?? r.mode}`,
    )
  })

  return d
    .rule()
    .bold(true)
    .pair(`Total (${s.totals.receipts})`, money(s.totals.total))
    .bold(false)
    .rule()
    .pair('Cash', money(s.totals.cash))
    .pair('Online', money(s.totals.online))
    .pair('Cheque', money(s.totals.cheque))
    .rule()
    .align('center')
    .text(header.collector)
    .feed()
    .build()
}

/** A short page to check the printer is paired and lined up. */
export function testPageEscPos(printerName: string) {
  return new Doc()
    .align('center')
    .bold(true)
    .text('PRINTER TEST')
    .bold(false)
    .text(printerName)
    .text(`${dLong(new Date())}, ${timeOf(new Date().toISOString())}`)
    .rule()
    .align('left')
    .pair('Left', 'Right')
    .text('1234567890'.repeat(4).slice(0, WIDTH))
    .align('center')
    .size(2)
    .text(money(12345), WIDTH / 2)
    .size(1)
    .text('If this is readable, receipts will print.')
    .feed()
    .build()
}
