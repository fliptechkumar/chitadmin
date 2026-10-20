import { CheckCircle2, IndianRupee, ShieldCheck, TrendingUp, Users } from "lucide-react"

import { CompanyMark } from "@/components/company-mark"
import { COMPANY_DEFAULTS, type CompanyProfile } from "@/lib/company-schema"

const HIGHLIGHTS = [
  {
    icon: <Users className="h-4 w-4" />,
    title: "Every group in one place",
    body: "Schemes, schedules and vacancies across all branches.",
  },
  {
    icon: <TrendingUp className="h-4 w-4" />,
    title: "Collections as they happen",
    body: "Receipts, penalties and agent targets tracked live.",
  },
  {
    icon: <ShieldCheck className="h-4 w-4" />,
    title: "Roles you control",
    body: "Granular permissions for managers, agents and accountants.",
  },
]

const HEADLINE = "Run your chit fund with numbers you can trust."

/** Bar heights for the decorative chart: each breathes between lo and hi. */
const BARS = [
  [0.3, 0.7],
  [0.45, 0.9],
  [0.35, 0.6],
  [0.55, 1],
  [0.4, 0.8],
  [0.6, 0.95],
  [0.5, 0.85],
]

/** Split layout shared by sign-in and registration. */
export default function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  company = COMPANY_DEFAULTS,
}: {
  eyebrow: string
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
  /** Defaults keep this usable from any caller that has not loaded settings. */
  company?: CompanyProfile
}) {
  return (
    <main className="flex min-h-svh bg-background">
      {/* Brand panel */}
      <section className="relative hidden w-[46%] max-w-xl flex-col justify-between overflow-hidden bg-brand p-10 text-brand-foreground lg:flex">
        {/* Slow-moving light, a faint dot grid, and a decorative chart card. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="auth-blob-a absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/25 blur-3xl" />
          <div className="auth-blob-b absolute -bottom-32 -right-20 h-[28rem] w-[28rem] rounded-full bg-white/15 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              maskImage: "radial-gradient(ellipse at 60% 40%, black 20%, transparent 70%)",
              WebkitMaskImage: "radial-gradient(ellipse at 60% 40%, black 20%, transparent 70%)",
            }}
          />
        </div>

        <div
          aria-hidden
          className="reveal-scale pointer-events-none absolute right-8 top-28 hidden xl:block"
          style={{ "--i": 6 } as React.CSSProperties}
        >
          <div className="auth-float w-52 rounded-2xl bg-white/12 p-4 shadow-2xl ring-1 ring-white/25 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="h-2 w-16 rounded-full bg-white/50" />
              <CheckCircle2 className="h-4 w-4 text-white/80" />
            </div>
            <div className="mt-4 flex h-20 items-end gap-1.5">
              {BARS.map(([lo, hi], i) => (
                <span
                  key={i}
                  className="auth-bar flex-1 rounded-t-md bg-white/70"
                  style={{ "--i": i, "--lo": lo, "--hi": hi, height: "100%" } as React.CSSProperties}
                />
              ))}
            </div>
            <div className="mt-3 space-y-1.5">
              <span className="block h-1.5 w-full rounded-full bg-white/25" />
              <span className="block h-1.5 w-2/3 rounded-full bg-white/25" />
            </div>
          </div>
        </div>

        <div className="reveal-fade relative flex items-center gap-3">
          <div
            className={
              company.logo
                ? "flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-white p-1 ring-1 ring-white/40"
                : "flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25"
            }
          >
            {company.logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={company.logo}
                alt={company.shortName}
                className="h-full w-full object-contain"
              />
            ) : (
              <IndianRupee className="h-6 w-6" />
            )}
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight">{company.shortName}</p>
            <p className="text-xs text-white/70">{company.name}</p>
          </div>
        </div>

        <div className="relative">
          <h2 className="max-w-sm text-3xl font-semibold leading-tight tracking-tight" aria-label={HEADLINE}>
            {HEADLINE.split(" ").map((word, i) => (
              <span key={i} aria-hidden>
                <span className="auth-word" style={{ "--i": i } as React.CSSProperties}>
                  {word}
                </span>{" "}
              </span>
            ))}
          </h2>
          <ul className="mt-8 space-y-5">
            {HIGHLIGHTS.map((h, i) => (
              <li
                key={h.title}
                style={{ "--i": i + 10 } as React.CSSProperties}
                className="reveal flex gap-3"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  {h.icon}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{h.title}</span>
                  <span className="block text-xs text-white/75">{h.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">
          © {new Date().getFullYear()} {company.name}
        </p>
      </section>

      {/* scp root@200.141.12.144:/root/MOOVAR-AUG05.jar ~/Downloads/ */}

      {/* Form panel */}
      <section className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-10 sm:px-8">
        {/* A soft brand glow behind the form, drifting like the panel's. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="auth-blob-b absolute -right-32 top-1/4 h-80 w-80 rounded-full bg-brand/10 blur-3xl" />
          <div className="auth-blob-a absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-violet/10 blur-3xl lg:hidden" />
        </div>
        <div className="reveal relative w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <CompanyMark company={company} className="h-12 w-12" iconClassName="h-5 w-5" />
            <p className="text-sm font-bold tracking-tight">{company.shortName}</p>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>

          <div className="mt-6">{children}</div>

          {footer && <div className="mt-6">{footer}</div>}
        </div>
      </section>
    </main>
  )
}
