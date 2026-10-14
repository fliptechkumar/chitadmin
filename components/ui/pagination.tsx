"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Select } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const ROWS_OPTIONS = [5, 10, 20, 50]

/** Page numbers around the current page, with 1 and last always present. */
function pageWindow(current: number, total: number) {
  return [1, current - 1, current, current + 1, total].filter(
    (p, i, all) => p >= 1 && p <= total && all.indexOf(p) === i
  )
}

function Pagination({
  page,
  totalPages,
  totalRows,
  rowsPerPage,
  onPageChange,
  onRowsChange,
  className,
}: {
  page: number
  totalPages: number
  totalRows: number
  rowsPerPage: number
  onPageChange: (page: number) => void
  onRowsChange: (rows: number) => void
  className?: string
}) {
  const first = totalRows === 0 ? 0 : (page - 1) * rowsPerPage + 1
  const last = Math.min(page * rowsPerPage, totalRows)

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 border-t border-border px-4 py-3",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Rows per page</span>
        <Select
          value={rowsPerPage}
          onChange={(e) => onRowsChange(Number(e.target.value))}
          className="h-8 text-xs"
          wrapperClassName="w-[4.75rem]"
          aria-label="Rows per page"
        >
          {ROWS_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <span className="tnum text-xs text-muted-foreground">
          {first}–{last} of {totalRows}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label="Previous page"
            className="press flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {pageWindow(page, totalPages).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "press tnum flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-xs font-medium",
                p === page
                  ? "border-brand bg-brand text-brand-foreground shadow-brand"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="press flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export { Pagination, ROWS_OPTIONS }
