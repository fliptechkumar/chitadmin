import { ChevronDown, Search } from "lucide-react"

import { cn } from "@/lib/utils"

const controlBase =
  "h-9 w-full rounded-lg border border-input bg-surface-2 px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-muted-foreground/70 hover:border-border focus:border-brand focus:bg-card focus:ring-4 focus:ring-brand/12 disabled:cursor-not-allowed disabled:opacity-60"

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(controlBase, className)} {...props} />
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(controlBase, "h-auto resize-none py-2 leading-relaxed", className)}
      {...props}
    />
  )
}

/**
 * Native select with the platform arrow replaced by a themed chevron.
 * `className` styles the control; `wrapperClassName` sizes it in a layout.
 */
function Select({
  className,
  wrapperClassName,
  children,
  ...props
}: React.ComponentProps<"select"> & { wrapperClassName?: string }) {
  return (
    <div className={cn("relative w-full", wrapperClassName)}>
      <select
        className={cn(controlBase, "cursor-pointer appearance-none pr-8", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

function SearchInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-9" type="search" {...props} />
    </div>
  )
}

function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string
  error?: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p className="animate-fade-in text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export { Input, Textarea, Select, SearchInput, Field, controlBase }
