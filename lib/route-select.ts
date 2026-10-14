import "server-only"

import type { Prisma } from "@/lib/generated/prisma"

/** Shared shape for list, detail and write responses, so the client sees one type. */
export const ROUTE_SELECT = {
  id: true,
  code: true,
  name: true,
  branch: true,
  areas: true,
  notes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  incharge: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, username: true } },
  executives: {
    select: { employee: { select: { id: true, name: true, branch: true } } },
    orderBy: { position: "asc" },
  },
} satisfies Prisma.RouteSelect

type RouteRow = Prisma.RouteGetPayload<{ select: typeof ROUTE_SELECT }>

/** Flattens the join table so the client gets a plain executives array. */
export function serializeRoute(row: RouteRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    branch: row.branch,
    areas: row.areas,
    notes: row.notes ?? "",
    isActive: row.isActive,
    incharge: row.incharge,
    createdBy: row.createdBy,
    executives: row.executives.map((e) => e.employee),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export type SerializedRoute = ReturnType<typeof serializeRoute>
