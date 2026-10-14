import { IndianRupee, ShieldCheck, TrendingUp, Users } from "lucide-react"

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
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 15%, rgba(255,255,255,0.28), transparent 45%), radial-gradient(circle at 85% 80%, rgba(255,255,255,0.18), transparent 50%)",
          }}
        />

        <div className="relative flex items-center gap-3">
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
          <h2 className="max-w-sm text-3xl font-semibold leading-tight tracking-tight">
            Run your chit fund with numbers you can trust.
          </h2>
          <ul className="mt-8 space-y-5">
            {HIGHLIGHTS.map((h, i) => (
              <li
                key={h.title}
                style={{ "--i": i + 1 } as React.CSSProperties}
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
      <section className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="reveal w-full max-w-md">
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
