/** Formatters ported from the prototype's ui.js. */

export const inr = (n: number | null | undefined) =>
  '₹' + Math.round(n || 0).toLocaleString('en-IN')

export const inrShort = (n: number) =>
  n >= 10000000
    ? '₹' + (n / 10000000).toFixed(2).replace(/\.?0+$/, '') + 'Cr'
    : n >= 100000
      ? '₹' + (n / 100000).toFixed(2).replace(/\.?0+$/, '') + 'L'
      : n >= 1000
        ? '₹' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
        : inr(n)

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-10-20" or "20/10/2026" or an ISO instant → Date (local noon). */
export function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12)
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], 12)
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const pad = (n: number) => String(n).padStart(2, '0')

export const dShort = (v: string | Date | null | undefined) => {
  const d = v instanceof Date ? v : toDate(v)
  return d ? `${pad(d.getDate())} ${MONTHS[d.getMonth()]}` : '—'
}

export const dLong = (v: string | Date | null | undefined) => {
  const d = v instanceof Date ? v : toDate(v)
  return d ? `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '—'
}

export const monthLabel = (v: string | Date | null | undefined) => {
  const d = v instanceof Date ? v : toDate(v)
  return d ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '—'
}

/** 2:05 PM */
export const timeOf = (iso: string) => {
  const d = new Date(iso)
  const h = d.getHours()
  return `${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

export const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

export const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export const MODE_LABEL: Record<string, string> = { cash: 'Cash', online: 'Online', cheque: 'Cheque' }
