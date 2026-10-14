import { PrismaClient } from "./generated/prisma"

// Reuse a single PrismaClient across hot-reloads in dev to avoid exhausting
// the Postgres connection pool. In production a fresh instance is fine.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
