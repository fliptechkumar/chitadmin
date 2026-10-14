import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CompanyMark } from "@/components/company-mark"
import { getCompany } from "@/lib/company"

const STATS = [
  { label: "Chit groups", value: "144" },
  { label: "Customers", value: "1,248" },
  { label: "Collected", value: "₹2.8Cr" },
]

export default async function Page() {
  const company = await getCompany()

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 10%, color-mix(in oklab, var(--brand) 22%, transparent), transparent 45%), radial-gradient(circle at 85% 85%, color-mix(in oklab, var(--violet) 18%, transparent), transparent 48%)",
        }}
      />

      <section className="reveal relative w-full max-w-xl rounded-2xl border border-border bg-card/90 p-8 shadow-lg backdrop-blur">
        <div className="flex items-center gap-3">
          <CompanyMark company={company} className="h-14 w-14" iconClassName="h-6 w-6" />
          <div>
            <p className="text-sm font-bold tracking-tight">{company.shortName}</p>
            <p className="text-xs text-muted-foreground">{company.name}</p>
          </div>
        </div>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Admin portal
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Chit fund operations, end to end.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Groups, customers, employees, collections, reports and settings — each
          visible only to the roles and branches you assign. Sign in to continue.
        </p>

        <dl className="mt-6 grid grid-cols-3 gap-3">
          {STATS.map(({ label, value }, i) => (
            <div
              key={label}
              style={{ "--i": i + 1 } as React.CSSProperties}
              className="reveal rounded-xl border border-border bg-surface-2 px-3 py-3 text-center"
            >
              <dt className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </dt>
              <dd className="tnum mt-0.5 text-lg font-bold tracking-tight">{value}</dd>
            </div>
          ))}
        </dl>

        {/* One way in: the destination after signing in depends on the role. */}
        <div className="mt-7">
          <Button asChild size="lg" className="group w-full">
            <Link href="/login">
              Sign in
              <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
