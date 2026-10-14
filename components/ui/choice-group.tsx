"use client"

import { cn } from "@/lib/utils"

/**
 * A radio group drawn as selectable pills. Replaces bare radio circles in
 * forms: the whole pill is a target, and the selected value reads at a glance.
 *
 * Arrow keys move between options, matching native radio behaviour.
 */
function ChoiceGroup({
  options,
  value,
  onChange,
  name,
  className,
}: {
  options: readonly string[]
  value: string
  onChange: (next: string) => void
  /** Accessible name for the group, e.g. "Gender". */
  name: string
  className?: string
}) {
  function handleKeyDown(event: React.KeyboardEvent, index: number) {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown"
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp"
    if (!forward && !back) return

    event.preventDefault()
    const delta = forward ? 1 : -1
    const next = (index + delta + options.length) % options.length
    onChange(options[next])
  }

  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((option, index) => {
        const selected = option === value
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            // Only the selected option (or the first, when empty) is tabbable,
            // so the group is a single stop in the tab order.
            tabIndex={selected || (!value && index === 0) ? 0 : -1}
            onClick={() => onChange(selected ? "" : option)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "press rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors duration-150",
              "focus-visible:ring-4 focus-visible:ring-brand/12 focus-visible:outline-none",
              selected
                ? "border-brand bg-brand-soft text-brand-soft-foreground"
                : "border-input bg-surface-2 text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

export { ChoiceGroup }
