import type { PageMeta } from "./response"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export type PageParams = { page: number; limit: number; skip: number; take: number }

/**
 * Reads ?page and ?limit, clamped so a client cannot ask for the whole table
 * in one request. Every v1 list endpoint is paginated for this reason — over a
 * cellular connection an unbounded list is the difference between a usable app
 * and a stalled one.
 */
export function pageParams(request: Request): PageParams {
  const url = new URL(request.url)

  const rawPage = Number(url.searchParams.get("page"))
  const rawLimit = Number(url.searchParams.get("limit"))

  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_LIMIT)
      : DEFAULT_LIMIT

  return { page, limit, skip: (page - 1) * limit, take: limit }
}

export function pageMeta(params: PageParams, total: number): PageMeta {
  const totalPages = Math.max(1, Math.ceil(total / params.limit))
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages,
    hasMore: params.page < totalPages,
  }
}

/** Trimmed ?q= search term, or null when absent. */
export function searchTerm(request: Request): string | null {
  const value = new URL(request.url).searchParams.get("q")?.trim()
  return value ? value : null
}
