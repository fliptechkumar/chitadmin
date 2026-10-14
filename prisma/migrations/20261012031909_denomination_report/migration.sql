-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "CashDenomination" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "branch" TEXT NOT NULL,
    "routeId" INTEGER,
    "scopeKey" TEXT NOT NULL,
    "counts" JSONB NOT NULL DEFAULT '{}',
    "total" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "countedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashDenomination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashDenomination_date_idx" ON "CashDenomination"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CashDenomination_date_scopeKey_key" ON "CashDenomination"("date", "scopeKey");

-- CreateIndex
CREATE INDEX "Collection_date_idx" ON "Collection"("date");

-- AddForeignKey
ALTER TABLE "CashDenomination" ADD CONSTRAINT "CashDenomination_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDenomination" ADD CONSTRAINT "CashDenomination_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
