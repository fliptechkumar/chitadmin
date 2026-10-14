-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('scheduled', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "Auction" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "auctionDate" TIMESTAMP(3) NOT NULL,
    "auctionTime" TEXT NOT NULL DEFAULT '10:00',
    "winnerTicketId" INTEGER,
    "prizeAmount" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "dividend" INTEGER NOT NULL DEFAULT 0,
    "status" "AuctionStatus" NOT NULL DEFAULT 'scheduled',

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Auction_groupId_installmentNo_key" ON "Auction"("groupId", "installmentNo");
CREATE INDEX "Auction_auctionDate_idx" ON "Auction"("auctionDate");
CREATE INDEX "Auction_status_idx" ON "Auction"("status");

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ChitGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_winnerTicketId_fkey" FOREIGN KEY ("winnerTicketId") REFERENCES "ChitTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
