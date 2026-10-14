import { IndianRupee } from "lucide-react"

import type { CompanyProfile } from "@/lib/company-schema"
import { cn } from "@/lib/utils"

/**
 * The logo tile. Falls back to the rupee glyph when no logo has been uploaded,
 * so the chrome never renders an empty box.
 *
 * The logo is a data URI straight from the database — next/image would have
 * nothing to optimise and cannot handle data URIs anyway.
 */
export function CompanyMark({
  company,
  className,
  iconClassName,
}: {
  company: Pick<CompanyProfile, "logo" | "shortName">
  className?: string
  iconClassName?: string
}) {
  if (company.logo) {
    return (
      <div
        className={cn(
          // White backing rather than a themed surface: an uploaded logo is
          // usually drawn for light paper, and would disappear against the
          // dark sidebar in dark mode. The inset keeps it off the rounded edge.
          "flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 ring-1 ring-border/60",
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={company.logo}
          alt={company.shortName}
          className="h-full w-full object-contain"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-brand",
        className
      )}
    >
      <IndianRupee className={cn("h-[18px] w-[18px]", iconClassName)} />
    </div>
  )
}
