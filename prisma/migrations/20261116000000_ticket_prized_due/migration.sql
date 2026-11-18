-- The auction round a seat took the pot in, for seats carried over from the
-- old register where no Auction row names the winner.
ALTER TABLE "ChitTicket" ADD COLUMN "prizedDue" INTEGER;
