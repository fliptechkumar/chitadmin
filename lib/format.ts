/** ₹1,20,000 — full rupee value with Indian digit grouping. */
export function inr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`
}

/** ₹4.2Cr / ₹5.6L / ₹46K — for tiles and axes where space is tight. */
export function inrCompact(n: number) {
  const abs = Math.abs(n)
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (abs >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (abs >= 1000) return `₹${Math.round(n / 1000)}K`
  return `₹${Math.round(n).toLocaleString("en-IN")}`
}

export function count(n: number) {
  return Math.round(n).toLocaleString("en-IN")
}

/**
 * 20 Aug 2026 — a yyyy-mm-dd calendar day, formatted without going through a
 * timezone conversion. Parsing it as a Date would read it as UTC midnight and
 * land on the previous day for anywhere behind UTC.
 */
export function formatDay(day: string) {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/** dd/MM/yyyy for today, matching the format used across the seed data. */
export function todayDisplay() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
}
