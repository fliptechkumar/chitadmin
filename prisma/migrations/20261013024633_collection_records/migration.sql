-- AlterTable
ALTER TABLE "TicketDue" ADD COLUMN     "routeId" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "TicketDue_routeId_idx" ON "TicketDue"("routeId");

-- AddForeignKey
ALTER TABLE "TicketDue" ADD CONSTRAINT "TicketDue_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;
