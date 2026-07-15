-- Surface the last-refresh error so users see WHY data is missing (e.g. Streckengeschäft
-- not indexed in Webisco public API) instead of a misleading "not yet loaded".
ALTER TABLE "TicketOrder"
  ADD COLUMN "lastLookupError" TEXT,
  ADD COLUMN "lastLookupAt" TIMESTAMP(3);
