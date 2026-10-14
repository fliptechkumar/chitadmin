"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

export type TabItem<T extends string> = {
  id: T
  label: string
  icon?: React.ReactNode
}

/**
 * Segmented control whose highlight slides between tabs. The pill is measured
 * from the active button, so tabs of different widths still line up.
 */
function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: readonly TabItem<T>[]
  value: T
  onChange: (id: T) => void
  className?: string
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)

  useEffect(() => {
    const list = listRef.current
    if (!list) return

    function measure() {
      const active = list?.querySelector<HTMLElement>('[data-active="true"]')
      if (!active) return
      setPill({ left: active.offsetLeft, width: active.offsetWidth })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [value, items])

  return (
    <div
      ref={listRef}
      role="tablist"
      className={cn(
        "relative flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1.5 shadow-sm",
        className
      )}
    >
      {pill && (
        <span
          aria-hidden
          className="absolute top-1.5 bottom-1.5 rounded-lg bg-brand shadow-brand transition-[transform,width] duration-300 ease-out-expo"
          style={{ transform: `translateX(${pill.left - 6}px)`, width: pill.width }}
        />
      )}
      {items.map(({ id, label, icon }) => {
        const active = id === value
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            data-active={active}
            onClick={() => onChange(id)}
            className={cn(
              "press relative z-10 flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold",
              active
                ? "text-brand-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {icon}
            {label}
          </button>
        )
      })}
    </div>
  )
}

export { SegmentedTabs }
