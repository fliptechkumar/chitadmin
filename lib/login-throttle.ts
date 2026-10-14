import "server-only"

/**
 * In-memory brute-force throttle for the login endpoint. Adequate for the
 * single-process deployment this app targets; move to Redis if the app is ever
 * run as multiple instances behind a load balancer, since each process would
 * otherwise keep its own counter.
 */

const MAX_ATTEMPTS = 8
const WINDOW_MS = 15 * 60 * 1000

type Bucket = { count: number; firstAttemptAt: number }

const buckets = new Map<string, Bucket>()

function sweep(now: number) {
  // Cheap to run on every call: the map only holds recent failing keys.
  for (const [key, bucket] of buckets) {
    if (now - bucket.firstAttemptAt > WINDOW_MS) buckets.delete(key)
  }
}

/** Seconds the caller must wait, or 0 when the attempt may proceed. */
export function retryAfter(key: string): number {
  const now = Date.now()
  sweep(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.count < MAX_ATTEMPTS) return 0

  const remaining = WINDOW_MS - (now - bucket.firstAttemptAt)
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0
}

export function recordFailure(key: string): void {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now - bucket.firstAttemptAt > WINDOW_MS) {
    buckets.set(key, { count: 1, firstAttemptAt: now })
    return
  }

  bucket.count += 1
}

export function clearFailures(key: string): void {
  buckets.delete(key)
}
