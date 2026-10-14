"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Animates from the previously shown number to `value`. Starts at 0 on first
 * paint, which matches what the server renders, so there is no hydration gap.
 */
export function useCountUp(value: number, duration = 900) {
  const [display, setDisplay] = useState(0)
  const shownRef = useRef(0)

  useEffect(() => {
    const from = shownRef.current
    const delta = value - from
    if (delta === 0) return

    // A zero-length run still lands on the final value in the first frame,
    // which is exactly what reduced-motion users should get.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const span = reduced ? 0 : duration

    let frame = 0
    const start = performance.now()

    function tick(now: number) {
      const t = span <= 0 ? 1 : Math.min(1, (now - start) / span)
      // easeOutQuart — fast arrival, gentle settle
      const eased = 1 - Math.pow(1 - t, 4)
      const next = from + delta * eased
      shownRef.current = next
      setDisplay(next)
      if (t < 1) frame = requestAnimationFrame(tick)
      else shownRef.current = value
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return display
}

type CountUpProps = {
  value: number
  /** Receives the in-flight value; return the string to paint. */
  format?: (n: number) => string
  duration?: number
  className?: string
}

export function CountUp({ value, format, duration, className }: CountUpProps) {
  const current = useCountUp(value, duration)
  const render = format ?? ((n: number) => Math.round(n).toLocaleString("en-IN"))
  return <span className={className}>{render(current)}</span>
}
