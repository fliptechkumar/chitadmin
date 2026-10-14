/**
 * Replaces the chit group register with the groups held in the source system
 * (chitpro). Every existing group goes first, and with it — by cascade — the
 * seats, auctions and dues hanging off it: the two registers are not merged,
 * because a half-imported register is worse than either one whole.
 *
 * Usage:
 *   npx tsx scripts/import-chitpro-groups.ts --dry           # map and report, write nothing
 *   npx tsx scripts/import-chitpro-groups.ts --file g.json   # import from a saved /group/list dump
 *   CHITPRO_EMAIL=... CHITPRO_PASSWORD=... npx tsx scripts/import-chitpro-groups.ts
 *
 * Roster and schedule creation is spelled out here rather than reused from
 * lib/, which is server-only and cannot be imported into a plain script — the
 * same reason prisma/seed.ts writes its own.
 */
import { PrismaClient, type GroupStatus } from "../lib/generated/prisma"
import { PERCENTAGE_OPTIONS, parseGroupInput } from "../lib/group-schema"

const prisma = new PrismaClient()

const API_BASE = "https://moovarapi.chitpro.in"
/** The hour branches open the hall, matching lib/group-schedule.ts. */
const AUCTION_TIME = "10:00"

/** One row of the source system's /group/list. Only the fields we read. */
type SourceGroup = {
  id: number
  groupName: string
  amount: number
  duration: string
  accountable: string
  commencementDate: string | null
  groupSpecialType: string | null
  branch: { name: string } | null
  groupType: { groupTypeName: string } | null
}

/** The source encodes its type as a number; ours is a word. */
const SPECIAL_TYPE_BY_CODE: Record<string, string> = {
  "0": "Regular",
  "1": "Special",
  "2": "Premium",
}

async function fetchFromSource(): Promise<SourceGroup[]> {
  const email = process.env.CHITPRO_EMAIL
  const password = process.env.CHITPRO_PASSWORD
  if (!email || !password) {
    throw new Error(
      "Pass --file <dump.json>, or set CHITPRO_EMAIL and CHITPRO_PASSWORD to pull live."
    )
  }

  const auth = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!auth.ok) throw new Error(`Login failed: ${auth.status}`)

  const { accessToken } = (await auth.json()) as { accessToken?: string }
  if (!accessToken) throw new Error("Login returned no access token")

  const res = await fetch(`${API_BASE}/group/list`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Group list failed: ${res.status}`)

  return (await res.json()) as SourceGroup[]
}

async function loadSource(file: string | null): Promise<SourceGroup[]> {
  if (!file) return fetchFromSource()

  const { readFile } = await import("node:fs/promises")
  return JSON.parse(await readFile(file, "utf8")) as SourceGroup[]
}

/** "2025-08-21" -> "21/08/2025", the form the register stores dates in. */
function toDisplayDate(iso: string) {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

/**
 * The last round's date: a 20-month chit starting on the 21st runs from its
 * first auction to the 19th month after it. Days that overrun a short month
 * fall back to that month's last day.
 */
function addMonths(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number)
  const lastOfTarget = new Date(y, m - 1 + months + 1, 0).getDate()
  return new Date(y, m - 1 + months, Math.min(d, lastOfTarget))
}

function toIso(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * The source keeps no status: a group is simply on the register. We read it
 * off the dates, which is what the register itself means by the word.
 */
function statusFor(start: Date, end: Date, today: Date): GroupStatus {
  if (end < today) return "completed"
  if (start > today) return "upcoming"
  return "active"
}

type Mapped = {
  id: number
  branchName: string
  specialType: string
  group: string
  percentage: string
  amount: number
  startDate: string
  endDate: string
  totalTickets: number
  status: GroupStatus
}

function mapGroup(row: SourceGroup, today: Date): { ok: true; data: Mapped } | { ok: false; why: string } {
  const percentage = row.groupType?.groupTypeName ?? ""
  if (!PERCENTAGE_OPTIONS.includes(percentage)) {
    return { ok: false, why: `unknown plan "${percentage || "(none)"}"` }
  }
  if (!row.commencementDate) return { ok: false, why: "no commencement date" }

  const duration = Number(row.duration)
  const totalTickets = Number(row.accountable)
  if (!Number.isInteger(duration) || duration < 1) {
    return { ok: false, why: `bad duration "${row.duration}"` }
  }
  if (!Number.isInteger(totalTickets) || totalTickets < 2) {
    return { ok: false, why: `bad seat count "${row.accountable}"` }
  }

  const start = new Date(`${row.commencementDate}T00:00:00`)
  const end = addMonths(row.commencementDate, duration - 1)

  const candidate = {
    branchName: row.branch?.name ?? "",
    specialType: SPECIAL_TYPE_BY_CODE[row.groupSpecialType ?? "0"] ?? "Regular",
    group: row.groupName,
    percentage,
    amount: Math.round(row.amount),
    startDate: toDisplayDate(row.commencementDate),
    endDate: toDisplayDate(toIso(end)),
    totalTickets,
    status: statusFor(start, end, today),
  }

  // Held to the same rules the form and the API enforce, so an imported group
  // is one a Chit Admin could have typed in themselves.
  const parsed = parseGroupInput(candidate)
  if (!parsed.ok) {
    const why = Object.entries(parsed.errors)
      .map(([field, message]) => `${field}: ${message}`)
      .join("; ")
    return { ok: false, why }
  }

  return { ok: true, data: { id: row.id, ...candidate } }
}

async function main() {
  const args = process.argv.slice(2)
  const dry = args.includes("--dry")
  const fileFlag = args.indexOf("--file")
  const file = fileFlag === -1 ? null : args[fileFlag + 1] ?? null

  const source = await loadSource(file)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const mapped: Mapped[] = []
  const skipped: { group: string; why: string }[] = []

  for (const row of source) {
    const result = mapGroup(row, today)
    if (result.ok) mapped.push(result.data)
    else skipped.push({ group: row.groupName ?? String(row.id), why: result.why })
  }

  const byStatus = mapped.reduce<Record<string, number>>((acc, g) => {
    acc[g.status] = (acc[g.status] ?? 0) + 1
    return acc
  }, {})
  const seats = mapped.reduce((sum, g) => sum + g.totalTickets, 0)

  console.log(`Source rows: ${source.length}`)
  console.log(`Mapped: ${mapped.length} groups, ${seats} seats — ${JSON.stringify(byStatus)}`)
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length}:`)
    for (const s of skipped) console.log(`  ${s.group}: ${s.why}`)
  }

  if (dry) {
    console.table(mapped.slice(0, 10))
    console.log("Dry run — nothing written.")
    return
  }

  if (mapped.length === 0) throw new Error("Nothing mapped; refusing to wipe the register.")

  const before = await prisma.chitGroup.count()

  await prisma.$transaction(
    async (tx) => {
      // Cascades through tickets, auctions and dues.
      await tx.chitGroup.deleteMany()

      for (const g of mapped) {
        await tx.chitGroup.create({
          // Source ids are kept so a later re-sync can still line the two
          // registers up. Seats all start empty, so every one is vacant.
          data: { ...g, members: 0, vacants: g.totalTickets },
        })

        await tx.chitTicket.createMany({
          data: Array.from({ length: g.totalTickets }, (_, i) => ({
            groupId: g.id,
            ticketNo: i + 1,
            isCompany: i === 0,
          })),
        })

        // One round a month on the start day, capped at the number of seats:
        // every member takes the pot once.
        const [d, m, y] = g.startDate.split("/").map(Number)
        const rounds = Math.min(monthsBetween(g.startDate, g.endDate), g.totalTickets)
        await tx.auction.createMany({
          data: Array.from({ length: rounds }, (_, i) => ({
            groupId: g.id,
            installmentNo: i + 1,
            auctionDate: new Date(y, m - 1 + i, d),
            auctionTime: AUCTION_TIME,
          })),
        })
      }

      // createMany with explicit ids leaves the sequence behind, and the next
      // group added through the app would collide with an imported id.
      await tx.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"ChitGroup"', 'id'), (SELECT MAX(id) FROM "ChitGroup"))`
      )
    },
    { timeout: 300_000, maxWait: 30_000 }
  )

  const [groups, tickets, auctions] = await Promise.all([
    prisma.chitGroup.count(),
    prisma.chitTicket.count(),
    prisma.auction.count(),
  ])

  console.log(`Replaced ${before} groups with ${groups}; ${tickets} seats, ${auctions} rounds.`)
}

/** Whole months from start to end inclusive, both dd/MM/yyyy. */
function monthsBetween(startDate: string, endDate: string) {
  const [, sm, sy] = startDate.split("/").map(Number)
  const [, em, ey] = endDate.split("/").map(Number)
  return (ey - sy) * 12 + (em - sm) + 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
