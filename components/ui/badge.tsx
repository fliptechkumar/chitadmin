import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold capitalize",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground",
        brand: "bg-brand-soft text-brand-soft-foreground",
        success: "bg-success-soft text-success-soft-foreground",
        warning: "bg-warning-soft text-warning-soft-foreground",
        danger: "bg-danger-soft text-danger-soft-foreground",
        violet: "bg-violet-soft text-violet-soft-foreground",
      },
      size: {
        sm: "px-2 py-0.5 text-2xs",
        md: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: { tone: "neutral", size: "sm" },
  }
)

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>

function Badge({
  className,
  tone,
  size,
  dot = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {dot && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" />
      )}
      {children}
    </span>
  )
}

const TONE_BY_STATUS: Record<string, BadgeTone> = {
  // shared lifecycle states
  active: "success",
  inactive: "neutral",
  completed: "neutral",
  upcoming: "brand",
  // collections
  paid: "success",
  pending: "warning",
  overdue: "danger",
  // kyc
  verified: "success",
  rejected: "danger",
  // payment modes
  cash: "neutral",
  online: "brand",
  cheque: "violet",
  // employee roles
  manager: "violet",
  supervisor: "brand",
  agent: "neutral",
  accountant: "success",
}

/** Maps a domain status string onto the badge palette. */
function toneFor(status: string): BadgeTone {
  return TONE_BY_STATUS[status.toLowerCase()] ?? "neutral"
}

export { Badge, badgeVariants, toneFor }
