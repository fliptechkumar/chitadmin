"use client"

import { useSyncExternalStore } from "react"

// The store never changes; the two snapshots are what matter.
const subscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

/**
 * `false` while rendering on the server and during hydration, `true` after.
 * Use it to gate browser-only reads (localStorage, matchMedia, resolved theme)
 * without a setState-in-effect round trip.
 */
export function useIsMounted() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
