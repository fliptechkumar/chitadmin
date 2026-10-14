-- A ticket can win at most once per group. NULL winners stay distinct in
-- Postgres, so unheld rounds are unaffected.
CREATE UNIQUE INDEX "Auction_groupId_winnerTicketId_key"
  ON "Auction"("groupId", "winnerTicketId");

-- One auction per group per calendar month. Expressed as an index on the
-- truncated date rather than a stored month column, so auctionDate stays the
-- single source of truth and the two cannot drift apart.
CREATE UNIQUE INDEX "Auction_group_month_key"
  ON "Auction"("groupId", (date_trunc('month', "auctionDate")));
