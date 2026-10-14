-- CreateEnum
CREATE TYPE "IntervalStatus" AS ENUM ('active', 'inactive');

-- AlterTable
ALTER TABLE "TicketDue" ADD COLUMN     "intervalId" INTEGER;

-- CreateTable
CREATE TABLE "ChitInterval" (
    "id" SERIAL NOT NULL,
    "scheme" TEXT NOT NULL,
    "chitValue" INTEGER NOT NULL,
    "months" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "status" "IntervalStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChitInterval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChitIntervalMonth" (
    "id" SERIAL NOT NULL,
    "intervalId" INTEGER NOT NULL,
    "monthNo" INTEGER NOT NULL,
    "installment" INTEGER NOT NULL,
    "payout" INTEGER,

    CONSTRAINT "ChitIntervalMonth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChitInterval_scheme_months_key" ON "ChitInterval"("scheme", "months");

-- CreateIndex
CREATE UNIQUE INDEX "ChitIntervalMonth_intervalId_monthNo_key" ON "ChitIntervalMonth"("intervalId", "monthNo");

-- AddForeignKey
ALTER TABLE "TicketDue" ADD CONSTRAINT "TicketDue_intervalId_fkey" FOREIGN KEY ("intervalId") REFERENCES "ChitInterval"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChitInterval" ADD CONSTRAINT "ChitInterval_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChitIntervalMonth" ADD CONSTRAINT "ChitIntervalMonth_intervalId_fkey" FOREIGN KEY ("intervalId") REFERENCES "ChitInterval"("id") ON DELETE CASCADE ON UPDATE CASCADE;
