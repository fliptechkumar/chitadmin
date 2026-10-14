-- AlterTable
ALTER TABLE "ChitTicket"
  ADD COLUMN "isPrized" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "prizedOn" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TicketDue" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountDue" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TicketDue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketDue_ticketId_installmentNo_key" ON "TicketDue"("ticketId", "installmentNo");
CREATE INDEX "TicketDue_dueDate_idx" ON "TicketDue"("dueDate");

-- AddForeignKey
ALTER TABLE "TicketDue" ADD CONSTRAINT "TicketDue_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ChitTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
