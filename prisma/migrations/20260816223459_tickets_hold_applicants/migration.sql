-- CreateEnum
CREATE TYPE "CollectionType" AS ENUM ('daily', 'weekly', 'monthly');

-- AlterTable: groups carry an explicit seat count
ALTER TABLE "ChitGroup" ADD COLUMN "totalTickets" INTEGER NOT NULL DEFAULT 20;

-- AlterTable: seats are filled from the applicant register, not the customer table
ALTER TABLE "ChitTicket" DROP CONSTRAINT "ChitTicket_customerId_fkey";
DROP INDEX "ChitTicket_customerId_idx";
ALTER TABLE "ChitTicket" DROP COLUMN "customerId";
ALTER TABLE "ChitTicket"
  ADD COLUMN "applicantId" INTEGER,
  ADD COLUMN "collectionType" "CollectionType" NOT NULL DEFAULT 'monthly';

-- CreateIndex
CREATE INDEX "ChitTicket_applicantId_idx" ON "ChitTicket"("applicantId");

-- AddForeignKey
ALTER TABLE "ChitTicket" ADD CONSTRAINT "ChitTicket_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
