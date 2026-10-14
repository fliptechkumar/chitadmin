import { cn } from "@/lib/utils"

function TableWrap({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("w-full overflow-x-auto", className)} {...props} />
}

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      className={cn("w-full border-collapse text-left text-sm", className)}
      {...props}
    />
  )
}

function THead({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn("bg-surface-2 [&_tr]:border-b [&_tr]:border-border", className)}
      {...props}
    />
  )
}

function TH({
  className,
  sortable = false,
  ...props
}: React.ComponentProps<"th"> & { sortable?: boolean }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
        sortable &&
          "group cursor-pointer select-none transition-colors hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function TBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={className} {...props} />
}

/**
 * Rows fade in on mount. Pass `index` to stagger; re-key the tbody on page or
 * filter change so a fresh set of rows animates in again.
 */
function TR({
  className,
  index,
  ...props
}: React.ComponentProps<"tr"> & { index?: number }) {
  return (
    <tr
      style={index === undefined ? undefined : ({ "--i": index } as React.CSSProperties)}
      className={cn(
        "border-b border-border/60 transition-colors last:border-0 hover:bg-muted/60",
        index !== undefined && "reveal-fade",
        className
      )}
      {...props}
    />
  )
}

function TD({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      className={cn("px-4 py-3 align-middle text-muted-foreground", className)}
      {...props}
    />
  )
}

export { TableWrap, Table, THead, TH, TBody, TR, TD }
