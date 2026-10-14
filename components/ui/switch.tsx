import { cn } from "@/lib/utils"

function Switch({
  checked,
  onCheckedChange,
  label,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange"> & {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200",
        checked ? "bg-brand" : "bg-muted-foreground/30",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ease-spring",
          checked ? "translate-x-[1.125rem]" : "translate-x-0.5"
        )}
      />
    </button>
  )
}

export { Switch }
