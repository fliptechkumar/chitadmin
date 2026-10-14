-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('active', 'suspended', 'closed');

-- CreateTable
CREATE TABLE "ChitTicket" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "ticketNo" INTEGER NOT NULL,
    "customerId" INTEGER,
    "routeId" INTEGER,
    "isCompany" BOOLEAN NOT NULL DEFAULT false,
    "status" "TicketStatus" NOT NULL DEFAULT 'active',
    "assignedAt" TIMESTAMP(3),

    CONSTRAINT "ChitTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChitTicket_groupId_ticketNo_key" ON "ChitTicket"("groupId", "ticketNo");
CREATE INDEX "ChitTicket_customerId_idx" ON "ChitTicket"("customerId");

-- AddForeignKey
ALTER TABLE "ChitTicket" ADD CONSTRAINT "ChitTicket_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ChitGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChitTicket" ADD CONSTRAINT "ChitTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChitTicket" ADD CONSTRAINT "ChitTicket_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;
