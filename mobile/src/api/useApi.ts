import { useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState, useSyncExternalStore } from 'react'

import { api, ApiError } from './client'

/**
 * Tiny stale-while-revalidate cache. A screen shows what it last loaded at
 * once and refreshes in the background whenever it comes into focus.
 * `invalidateAll()` after a payment makes every screen refetch.
 */

const cache = new Map<string, unknown>()
let version = 0
const listeners = new Set<() => void>()

export function invalidateAll() {
  version += 1
  listeners.forEach((l) => l())
}

export function clearCache() {
  cache.clear()
  invalidateAll()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | undefined>(() =>
    path ? (cache.get(path) as T | undefined) : undefined,
  )
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const seq = useRef(0)
  const v = useSyncExternalStore(subscribe, () => version)

  const load = useCallback(
    async (mode: 'background' | 'pull' = 'background') => {
      if (!path) return
      const id = ++seq.current
      if (mode === 'pull') setRefreshing(true)
      else setLoading(true)
      try {
        const next = await api<T>(path)
        if (id !== seq.current) return
        cache.set(path, next)
        setData(next)
        setError(null)
      } catch (e) {
        if (id !== seq.current) return
        setError(e instanceof ApiError ? e : new ApiError(String(e), 'INTERNAL', 0))
      } finally {
        if (id === seq.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [path],
  )

  // A different path (e.g. another member) starts from its own cache entry.
  const [shownPath, setShownPath] = useState(path)
  if (shownPath !== path) {
    setShownPath(path)
    setData(path ? (cache.get(path) as T | undefined) : undefined)
    setError(null)
  }

  // Reload on focus, and again whenever invalidateAll() bumps the version.
  useFocusEffect(
    useCallback(() => {
      if (v >= 0) void load()
    }, [load, v]),
  )

  return {
    data,
    error,
    /** True only while there is nothing to show yet. */
    loading: loading && data === undefined,
    refreshing,
    refresh: () => load('pull'),
    reload: () => load(),
  }
}
