-- CreateTable
CREATE TABLE "AuctionHallEntry" (
    "id" SERIAL NOT NULL,
    "auctionId" INTEGER NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionHallEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuctionHallEntry_ticketId_idx" ON "AuctionHallEntry"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionHallEntry_auctionId_ticketId_key" ON "AuctionHallEntry"("auctionId", "ticketId");

-- AddForeignKey
ALTER TABLE "AuctionHallEntry" ADD CONSTRAINT "AuctionHallEntry_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionHallEntry" ADD CONSTRAINT "AuctionHallEntry_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ChitTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
