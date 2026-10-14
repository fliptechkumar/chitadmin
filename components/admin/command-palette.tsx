"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CornerDownLeft, Search } from "lucide-react"

import type { NavItem } from "./nav"
import { cn } from "@/lib/utils"

/**
 * ⌘K launcher over the nav. Kept deliberately small: it filters destinations
 * and navigates, nothing else. Mounted only while open, so its query state
 * resets naturally on every launch.
 *
 * `items` arrives already filtered to the current role, so the palette cannot
 * surface a destination the user would be bounced from.
 */
export default function CommandPalette({
  items,
  onClose,
}: {
  items: NavItem[]
  onClose: () => void
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [cursor, setCursor] = useState(0)

  const results = items.filter((item) => {
    const q = query.trim().toLowerCase()
    return (
      !q ||
      item.label.toLowerCase().includes(q) ||
      item.hint.toLowerCase().includes(q)
    )
  })

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 20)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      clearTimeout(timer)
      document.body.style.overflow = previousOverflow
    }
  }, [])

  function go(href: string) {
    onClose()
    router.push(href)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onClose()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setCursor((c) => (results.length ? (c + 1) % results.length : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setCursor((c) => (results.length ? (c - 1 + results.length) % results.length : 0))
    } else if (e.key === "Enter" && results[cursor]) {
      e.preventDefault()
      go(results[cursor].href)
    }
  }

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-start justify-center bg-foreground/25 p-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search navigation"
        onKeyDown={onKeyDown}
        className="animate-scale-in w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-popover shadow-lg"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCursor(0)
            }}
            placeholder="Jump to…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground focus-visible:outline-none"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        <ul className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nothing matches “{query}”.
            </li>
          )}
          {results.map((item, i) => {
            const Icon = item.icon
            return (
              <li key={item.href}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(item.href)}
                  style={{ "--i": i } as React.CSSProperties}
                  className={cn(
                    "reveal-fade flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    i === cursor ? "bg-brand-soft" : "hover:bg-muted"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      i === cursor ? "text-brand-soft-foreground" : "text-muted-foreground"
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {item.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.hint}
                    </span>
                  </span>
                  {i === cursor && (
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-brand-soft-foreground" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
