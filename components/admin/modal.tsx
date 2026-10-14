"use client"

import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

type ModalProps = {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  size?: "sm" | "md" | "lg"
}

const SIZES = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const

/** Must match the exit animation length declared in globals.css. */
const EXIT_MS = 180

/**
 * Minimal accessible dialog: backdrop click and Escape close it, the page
 * behind is scroll-locked, and focus moves into the panel on open. The panel
 * stays mounted for the length of the exit animation so closing is animated.
 */
export default function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "lg",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [present, setPresent] = useState(open)

  // Mounting is derived during render so opening paints in the same commit.
  if (open && !present) setPresent(true)

  useEffect(() => {
    if (open) return
    const timer = setTimeout(() => setPresent(false), EXIT_MS)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }

    document.addEventListener("keydown", onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    panelRef.current?.focus()

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!present) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 overflow-y-auto bg-foreground/30 backdrop-blur-sm",
        open ? "animate-fade-in" : "animate-fade-out"
      )}
    >
      {/*
        `min-h-full` lets this wrapper grow past the viewport, so a tall panel
        stays reachable. Centring on the scroll container itself would push the
        overflow outside the scrollable area, leaving the footer unclickable.
      */}
      <div
        className="flex min-h-full items-center justify-center p-4"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          className={cn(
            // Capped to the viewport so the header and footer are always on
            // screen and only the body scrolls — long forms keep their actions
            // visible instead of running off the bottom.
            "flex max-h-[calc(100svh-2rem)] w-full flex-col rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg outline-none",
            SIZES[size],
            open ? "animate-scale-in" : "animate-scale-out"
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight">{title}</h2>
              {description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="press -mr-1 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer && (
            <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
