-- CreateEnum
CREATE TYPE "SessionKind" AS ENUM ('web', 'mobile');

-- AlterTable
ALTER TABLE "Session"
  ADD COLUMN "kind" "SessionKind" NOT NULL DEFAULT 'web',
  ADD COLUMN "refreshTokenHash" TEXT,
  ADD COLUMN "refreshExpiresAt" TIMESTAMP(3),
  ADD COLUMN "lastUsedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Session_refreshExpiresAt_idx" ON "Session"("refreshExpiresAt");
