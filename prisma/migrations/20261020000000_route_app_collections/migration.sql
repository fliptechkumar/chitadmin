-- Receipts written by the route mobile app belong to a seat, not the legacy
-- customer register, and remember the route they were collected on.
ALTER TABLE "Collection" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "Collection" ADD COLUMN "ticketId" INTEGER;
ALTER TABLE "Collection" ADD COLUMN "routeId" INTEGER;
ALTER TABLE "Collection" ADD COLUMN "reference" TEXT;
ALTER TABLE "Collection" ADD COLUMN "note" TEXT;

CREATE INDEX "Collection_routeId_date_idx" ON "Collection"("routeId", "date");
CREATE INDEX "Collection_ticketId_idx" ON "Collection"("ticketId");

ALTER TABLE "Collection" ADD CONSTRAINT "Collection_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ChitTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;
