"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

type Tone = "brand" | "success" | "warning" | "danger" | "violet"

const FILL: Record<Tone, string> = {
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  violet: "bg-violet",
}

const STROKE: Record<Tone, string> = {
  brand: "text-brand",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  violet: "text-violet",
}

/** Picks a tone from an achievement percentage. */
function toneForPct(pct: number): Tone {
  if (pct >= 100) return "success"
  if (pct >= 75) return "brand"
  if (pct >= 50) return "warning"
  return "danger"
}

/** Grows from zero on mount so the bar reads as a measurement being taken. */
function useAnimatedValue(target: number, delay = 60) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const timer = setTimeout(() => setValue(target), delay)
    return () => clearTimeout(timer)
  }, [target, delay])
  return value
}

function ProgressBar({
  pct,
  tone,
  className,
  delay,
}: {
  pct: number
  tone?: Tone
  className?: string
  delay?: number
}) {
  const width = useAnimatedValue(Math.min(100, Math.max(0, pct)), delay)
  const resolved = tone ?? toneForPct(pct)

  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out-expo", FILL[resolved])}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

function ProgressRing({
  pct,
  tone = "brand",
  label,
  caption,
  size = 84,
  stroke = 8,
  delay,
}: {
  pct: number
  tone?: Tone
  label?: string
  caption?: string
  size?: number
  stroke?: number
  delay?: number
}) {
  const clamped = Math.min(100, Math.max(0, pct))
  const value = useAnimatedValue(clamped, delay)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ height: size, width: size }}>
        <svg
          className="-rotate-90"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn(
              "transition-[stroke-dashoffset] duration-1000 ease-out-expo",
              STROKE[tone]
            )}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="tnum text-sm font-bold text-foreground">
            {Math.round(clamped)}%
          </span>
        </div>
      </div>
      {label && <p className="text-xs font-medium text-foreground">{label}</p>}
      {caption && <p className="tnum text-xs text-muted-foreground">{caption}</p>}
    </div>
  )
}

export { ProgressBar, ProgressRing, toneForPct }
