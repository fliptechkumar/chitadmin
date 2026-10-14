import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/** Filter bar that sits above a table: search, selects, then trailing actions. */
function Toolbar({
  children,
  onClear,
  showClear = false,
  actions,
  className,
}: {
  children: React.ReactNode
  onClear?: () => void
  showClear?: boolean
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <Card
      className={cn("reveal flex flex-wrap items-center gap-3 p-3", className)}
      style={{ "--i": 1 } as React.CSSProperties}
    >
      {children}
      {showClear && onClear && (
        <Button
          variant="destructive-soft"
          size="sm"
          onClick={onClear}
          className="animate-scale-in"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </Card>
  )
}

export { Toolbar }
