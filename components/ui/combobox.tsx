"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Popover as Primitive } from "radix-ui"
import { Check, ChevronDown, Search } from "lucide-react"

import { controlBase } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type ComboboxOption = {
  value: string
  label: string
  /** Secondary text on the right of the row, e.g. an amount. */
  hint?: string
  /** Heading the option is listed under. Options sharing one are kept together. */
  group?: string
  /** Extra text matched by the search but not shown. */
  keywords?: string
}

/**
 * A select with a search box, for lists too long to scroll by eye. Built on
 * Radix Popover for positioning, focus return and outside-click; the list and
 * its keyboard handling (↑ ↓ Enter Esc) are kept here.
 */
function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches",
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  "aria-label"?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [cursor, setCursor] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  const results = useMemo(() => {
    // Every word must match somewhere, so "kov 18" finds MIKEE18 in KovilPatti.
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return options
    return options.filter((o) => {
      const haystack = `${o.label} ${o.hint ?? ""} ${o.group ?? ""} ${o.keywords ?? ""}`.toLowerCase()
      return words.every((w) => haystack.includes(w))
    })
  }, [options, query])

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [cursor])

  function openChange(next: boolean) {
    setOpen(next)
    if (next) {
      setQuery("")
      setCursor(Math.max(0, options.findIndex((o) => o.value === value)))
    }
  }

  function choose(option: ComboboxOption) {
    onChange(option.value)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setCursor((c) => (results.length ? (c + 1) % results.length : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setCursor((c) => (results.length ? (c - 1 + results.length) % results.length : 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const option = results[cursor]
      if (option) choose(option)
    }
  }

  return (
    <Primitive.Root open={open} onOpenChange={openChange}>
      <Primitive.Trigger
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          controlBase,
          "flex cursor-pointer items-center gap-2 pr-2.5 text-left data-[state=open]:border-brand data-[state=open]:bg-card data-[state=open]:ring-4 data-[state=open]:ring-brand/12",
          className
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground/70")}>
          {selected ? (
            <>
              {selected.label}
              {selected.hint && <span className="text-muted-foreground"> · {selected.hint}</span>}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Primitive.Trigger>

      <Primitive.Portal>
        <Primitive.Content
          align="start"
          sideOffset={6}
          onKeyDown={onKeyDown}
          className={cn(
            "z-[70] w-[var(--radix-popover-trigger-width)] min-w-[16rem] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg",
            "origin-[var(--radix-popover-content-transform-origin)]",
            "data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out"
          )}
        >
          <div className="relative border-b border-border">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setCursor(0)
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-10 w-full bg-transparent pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            />
          </div>

          <div ref={listRef} role="listbox" className="max-h-72 overflow-y-auto p-1.5">
            {results.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">{emptyText}</p>
            ) : (
              results.map((option, index) => {
                const heading = option.group && option.group !== results[index - 1]?.group
                const active = index === cursor
                const isSelected = option.value === value
                return (
                  <div key={option.value}>
                    {heading && (
                      <p className="px-2.5 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground first:pt-1">
                        {option.group}
                      </p>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-index={index}
                      onMouseMove={() => setCursor(index)}
                      onClick={() => choose(option)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                        active ? "bg-muted text-foreground" : "text-foreground/90"
                      )}
                    >
                      <Check className={cn("h-3.5 w-3.5 shrink-0 text-brand", !isSelected && "invisible")} />
                      <span className="min-w-0 flex-1 truncate font-medium">{option.label}</span>
                      {option.hint && (
                        <span className="tnum shrink-0 text-xs text-muted-foreground">{option.hint}</span>
                      )}
                    </button>
                  </div>
                )
              })
            )}
          </div>

          <div className="border-t border-border px-3 py-1.5 text-2xs text-muted-foreground">
            {results.length} of {options.length} · ↑↓ to move · Enter to select
          </div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  )
}

export { Combobox }
