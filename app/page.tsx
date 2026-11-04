import Link from "next/link"
import { cookies } from "next/headers"
import {
  ArrowRight,
  BadgeCheck,
  Bike,
  CalendarCheck,
  Gavel,
  HandCoins,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  UserPlus,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { CompanyMark } from "@/components/company-mark"
import { getCompany } from "@/lib/company"
import { inr } from "@/lib/format"
import { prisma } from "@/lib/prisma"
import { homeFor } from "@/lib/roles"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session"

/**
 * The public front page of the site. Everything specific to the business —
 * name, contact, branches and plans — is read live, so nothing here goes stale
 * or claims a figure the company did not enter.
 */

type Plan = { value: number; months: number; groups: number }

/** Plans on offer: one card per chit value and duration with an active group. */
async function getPlans(): Promise<Plan[]> {
  const rows = await prisma.chitGroup.groupBy({
    by: ["amount", "totalTickets"],
    where: { status: "active" },
    _count: { _all: true },
    orderBy: [{ amount: "asc" }, { totalTickets: "asc" }],
  })
  return rows
    .filter((r) => r.amount > 0 && r.totalTickets > 0)
    .map((r) => ({ value: r.amount, months: r.totalTickets, groups: r._count._all }))
}

async function getBranches(): Promise<string[]> {
  const rows = await prisma.chitGroup.findMany({
    distinct: ["branchName"],
    select: { branchName: true },
    orderBy: { branchName: "asc" },
  })
  return rows.map((r) => r.branchName.trim()).filter(Boolean)
}

const lakh = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toLocaleString("en-IN", { maximumFractionDigits: 1 })} Lakh` : inr(n)

const STEPS = [
  {
    icon: UserPlus,
    title: "Join a group",
    text: "Pick a chit value and duration that suits your budget. Each member holds one ticket in the group.",
  },
  {
    icon: CalendarCheck,
    title: "Pay monthly",
    text: "Pay the instalment every month at our office or to our collector at your doorstep.",
  },
  {
    icon: Gavel,
    title: "Monthly auction",
    text: "Each month the members bid for the chit amount. The discount is shared back as a dividend.",
  },
  {
    icon: HandCoins,
    title: "Take the amount",
    text: "Win an auction when you need funds, or wait and receive the full value later in the term.",
  },
]

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Registered company",
    text: "Groups run under a registered chit fund company, with records kept for every member.",
  },
  {
    icon: Bike,
    title: "Doorstep collection",
    text: "Our route collectors visit you on a fixed schedule, so you never miss an instalment.",
  },
  {
    icon: ReceiptText,
    title: "Receipt for every payment",
    text: "Each payment gets a numbered receipt, printed on the spot or shared to your phone.",
  },
  {
    icon: Gavel,
    title: "Transparent auctions",
    text: "Auctions are held openly every month and the dividend is credited to every member.",
  },
  {
    icon: Smartphone,
    title: "Up-to-date records",
    text: "Your dues, payments and auction history are recorded the day they happen.",
  },
  {
    icon: Users,
    title: "Local and personal",
    text: "Speak to people who know you. Our branch team is a phone call or a short walk away.",
  },
]

export default async function Page() {
  const [company, plans, branches, cookieStore] = await Promise.all([
    getCompany(),
    getPlans(),
    getBranches(),
    cookies(),
  ])
  const claims = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)
  const portal = claims
    ? { href: homeFor(claims.role), label: "Open dashboard" }
    : { href: "/login", label: "Sign in" }

  const address = [company.addressLine, company.city, company.state, company.pincode]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ")
  const tel = company.phone.replace(/[^\d+]/g, "")
  const year = new Date().getFullYear()

  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-sidebar/95 text-white backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <CompanyMark company={company} className="h-9 w-9" iconClassName="h-4 w-4" />
            <span className="truncate text-base font-bold tracking-tight">{company.name}</span>
          </Link>
          <nav className="ml-auto hidden items-center gap-6 text-sm text-white/75 md:flex">
            <a href="#plans" className="transition-colors hover:text-white">Plans</a>
            <a href="#how" className="transition-colors hover:text-white">How it works</a>
            <a href="#why" className="transition-colors hover:text-white">Why us</a>
            <a href="#contact" className="transition-colors hover:text-white">Contact</a>
          </nav>
          <Button asChild size="sm" className="ml-auto bg-white text-sidebar hover:bg-white/90 md:ml-0">
            <Link href={portal.href}>{portal.label}</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-sidebar text-white">
        <HeroBackdrop />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.15fr_1fr]">
          <div className="reveal">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
              <BadgeCheck className="h-3.5 w-3.5 text-sky-300" />
              Registered chit fund{company.city ? ` · ${company.city}` : ""}
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              Save every month.
              <br />
              <span className="text-sky-300">Get funds when you need them.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75">
              {company.name} runs chit groups for families, traders and small businesses —
              a disciplined way to save, with the option to take the chit amount early
              for a wedding, education, business or emergency.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="group bg-white text-sidebar hover:bg-white/90">
                <a href="#plans">
                  View chit plans
                  <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                </a>
              </Button>
              {tel ? (
                <Button asChild size="lg" variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10">
                  <a href={`tel:${tel}`}>
                    <Phone />
                    Call {company.phone}
                  </a>
                </Button>
              ) : null}
            </div>
          </div>

          <HeroCard />
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-border sm:grid-cols-4">
          {[
            [ShieldCheck, company.regNo ? `Reg. ${company.regNo}` : "Registered company"],
            [Bike, "Doorstep collection"],
            [ReceiptText, "Receipt for every payment"],
            [Gavel, "Open monthly auctions"],
          ].map(([Icon, label]) => {
            const I = Icon as typeof ShieldCheck
            return (
              <div key={label as string} className="flex items-center gap-3 bg-card px-4 py-5 sm:px-6">
                <I className="h-5 w-5 shrink-0 text-brand" />
                <span className="text-sm font-medium">{label as string}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="scroll-mt-16 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle
            eyebrow="Chit plans"
            title="A plan for every budget"
            text="Groups that are open now. The instalment shown is the full monthly share; after each auction's dividend you usually pay less."
          />
          {plans.length ? (
            <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {plans.map((p) => (
                <div
                  key={`${p.value}-${p.months}`}
                  className="rounded-2xl border border-border bg-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md sm:p-6"
                >
                  <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
                    Chit value
                  </p>
                  <p className="tnum mt-1 text-xl font-bold tracking-tight sm:text-2xl">{lakh(p.value)}</p>
                  <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs sm:mt-5 sm:space-y-2 sm:pt-4 sm:text-sm">
                    <p className="font-medium">{p.months} months</p>
                    <p className="text-muted-foreground">
                      Up to <span className="tnum font-medium text-foreground">{inr(Math.round(p.value / p.months))}</span> / month
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              New groups are starting soon. Contact us to reserve a ticket.
            </p>
          )}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-16 bg-surface-2 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle
            eyebrow="How it works"
            title="Simple, from the first month to the last"
            text="A chit is a group savings scheme: everyone contributes each month and one member takes the pooled amount."
          />
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="relative rounded-2xl border border-border bg-card p-6">
                <span className="tnum absolute right-5 top-4 text-4xl font-bold text-muted-foreground/15">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Why us */}
      <section id="why" className="scroll-mt-16 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle
            eyebrow="Why choose us"
            title={`Why members trust ${company.name}`}
          />
          <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-16 px-4 pb-16 sm:px-6 md:pb-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-sidebar px-6 py-12 text-white sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl"
          />
          <div className="relative grid gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Ready to start saving?</h2>
              <p className="mt-3 max-w-md text-white/75">
                Visit our office or call us. We will help you choose a group and explain every
                detail before you join.
              </p>
              {branches.length ? (
                <p className="mt-6 text-sm text-white/60">
                  Branches: <span className="text-white/90">{branches.join(" · ")}</span>
                </p>
              ) : null}
            </div>
            <ul className="space-y-4 text-sm">
              {address ? (
                <ContactRow icon={MapPin} label="Office">
                  <a
                    className="hover:underline"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${company.name}, ${address}`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {address}
                  </a>
                </ContactRow>
              ) : null}
              {tel ? (
                <ContactRow icon={Phone} label="Phone">
                  <a className="hover:underline" href={`tel:${tel}`}>{company.phone}</a>
                </ContactRow>
              ) : null}
              {company.email ? (
                <ContactRow icon={Mail} label="Email">
                  <a className="hover:underline" href={`mailto:${company.email}`}>{company.email}</a>
                </ContactRow>
              ) : null}
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-2.5">
            <CompanyMark company={company} className="h-7 w-7 rounded-lg" iconClassName="h-3.5 w-3.5" />
            <span>
              © {year} {company.name}
              {company.gst ? ` · GSTIN ${company.gst}` : ""}
            </span>
          </div>
          <div className="flex gap-5 sm:ml-auto">
            <a href="#plans" className="hover:text-foreground">Plans</a>
            <a href="#contact" className="hover:text-foreground">Contact</a>
            <Link href={portal.href} className="hover:text-foreground">Staff {portal.label.toLowerCase()}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {text ? <p className="mt-3 text-muted-foreground">{text}</p> : null}
    </div>
  )
}

function ContactRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Phone
  label: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-xs text-white/55">{label}</p>
        <div className="mt-0.5 text-white/90">{children}</div>
      </div>
    </li>
  )
}

/** A wave across the hero as a smooth path; `lift` flips the crests so two of these morph. */
function wave(y: number, amp: number, lift: 1 | -1) {
  const w = 1440 / 8
  let d = `M0,${y} Q${w / 2},${y - amp * lift} ${w},${y}`
  for (let x = w * 2; x <= 1440; x += w) d += ` T${x},${y}`
  return d
}

const WAVES = [
  { y: 470, amp: 38, dur: 11, stroke: "oklch(0.8 0.1 235 / 35%)", fill: "oklch(0.62 0.15 245 / 10%)" },
  { y: 520, amp: 28, dur: 15, stroke: "oklch(0.8 0.1 235 / 22%)", fill: "oklch(0.55 0.14 250 / 12%)" },
  { y: 575, amp: 22, dur: 19, stroke: "oklch(0.8 0.1 235 / 15%)", fill: "oklch(0.45 0.12 252 / 18%)" },
]

/** Fixed spots for the twinkling dots, so server and client render the same. */
const SPARKS = [
  [120, 90], [260, 210], [410, 70], [560, 160], [700, 60], [820, 230],
  [960, 110], [1080, 50], [1190, 190], [1330, 95], [340, 330], [1260, 320],
] as const

/** Savings growing month by month, drawn along the lower right. */
const GROWTH = "M760,560 L860,530 L940,545 L1030,480 L1110,495 L1200,420 L1290,435 L1400,340"

/**
 * The hero's moving background: drifting glows, three slow waves, a growth
 * line that draws itself, and twinkling dots. The motion is SVG's own, so it
 * needs no stylesheet, and it is hidden for anyone who asks for reduced motion.
 */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="auth-blob-a absolute -right-24 -top-32 h-[28rem] w-[28rem] rounded-full bg-[oklch(0.62_0.15_245/40%)] blur-3xl" />
      <div className="auth-blob-b absolute -bottom-40 -left-24 h-[30rem] w-[30rem] rounded-full bg-[oklch(0.5_0.14_250/35%)] blur-3xl" />

      <svg
        className="absolute inset-0 h-full w-full motion-reduce:hidden"
        viewBox="0 0 1440 640"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="hero-dots" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="oklch(1 0 0 / 10%)" />
          </pattern>
          <radialGradient id="hero-fade" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor="white" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="hero-mask">
            <rect width="1440" height="640" fill="url(#hero-fade)" />
          </mask>
          <linearGradient id="hero-growth" x1="0" x2="1">
            <stop offset="0%" stopColor="oklch(0.85 0.12 230)" stopOpacity="0" />
            <stop offset="100%" stopColor="oklch(0.88 0.13 220)" />
          </linearGradient>
        </defs>

        <rect width="1440" height="640" fill="url(#hero-dots)" mask="url(#hero-mask)" />

        {SPARKS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2.2 : 1.5} fill="oklch(0.92 0.06 230)" opacity="0">
            <animate
              attributeName="opacity"
              values="0;0.9;0"
              dur={`${3 + (i % 4)}s`}
              begin={`${(i * 0.7) % 4}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}

        {WAVES.map(({ y, amp, dur, stroke, fill }) => {
          const a = wave(y, amp, 1)
          const b = wave(y, amp, -1)
          return (
            <g key={y}>
              <path d={`${a} L1440,640 L0,640 Z`} fill={fill}>
                <animate
                  attributeName="d"
                  values={`${a} L1440,640 L0,640 Z;${b} L1440,640 L0,640 Z;${a} L1440,640 L0,640 Z`}
                  dur={`${dur}s`}
                  repeatCount="indefinite"
                  calcMode="spline"
                  keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
                />
              </path>
              <path d={a} fill="none" stroke={stroke} strokeWidth="1.5">
                <animate
                  attributeName="d"
                  values={`${a};${b};${a}`}
                  dur={`${dur}s`}
                  repeatCount="indefinite"
                  calcMode="spline"
                  keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
                />
              </path>
            </g>
          )
        })}

        <path
          d={GROWTH}
          fill="none"
          stroke="url(#hero-growth)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset="1"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="1;0;0;1"
            keyTimes="0;0.45;0.85;1"
            dur="9s"
            repeatCount="indefinite"
          />
        </path>
        <circle r="5" fill="oklch(0.92 0.12 220)" opacity="0">
          <animateMotion
            path={GROWTH}
            keyPoints="0;1;1;1"
            keyTimes="0;0.45;0.85;1"
            calcMode="linear"
            dur="9s"
            repeatCount="indefinite"
          />
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.8;0.9" dur="9s" repeatCount="indefinite" />
          <animate attributeName="r" values="4;6;4" dur="1.5s" repeatCount="indefinite" />
        </circle>
      </svg>

      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-sidebar to-transparent" />
    </div>
  )
}

/** An illustration of a member's passbook. Labelled as an example, not live data. */
function HeroCard() {
  const months = [
    { m: "Month 1", paid: true },
    { m: "Month 2", paid: true },
    { m: "Month 3", paid: true },
    { m: "Month 4", paid: false },
  ]
  return (
    <div className="reveal relative mx-auto w-full max-w-sm" style={{ "--i": 3 } as React.CSSProperties}>
      <div className="hero-pulse absolute -inset-6 rounded-[2rem] bg-sky-400/20 blur-2xl" aria-hidden />
      <div className="auth-float relative rounded-2xl bg-white p-6 text-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500">Example plan</p>
            <p className="tnum text-xl font-bold tracking-tight sm:text-2xl">₹1 Lakh · 20 months</p>
          </div>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            On track
          </span>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-[15%] rounded-full bg-[oklch(0.5_0.14_250)]" />
        </div>
        <p className="mt-2 text-xs text-slate-500">3 of 20 instalments paid</p>
        <ul className="mt-5 divide-y divide-slate-100 text-sm">
          {months.map(({ m, paid }) => (
            <li key={m} className="flex items-center justify-between py-2.5">
              <span className="text-slate-600">{m}</span>
              <span className="tnum flex items-center gap-2 font-medium">
                ₹5,000
                <span
                  className={
                    paid
                      ? "rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700"
                      : "rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700"
                  }
                >
                  {paid ? "Paid" : "Due"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
