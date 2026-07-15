-- Extend TicketOrder with Webisco snapshot fields so AI + UI can show real order data.
ALTER TABLE "TicketOrder"
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN "emailMatched" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "status" TEXT,
  ADD COLUMN "totalBrutto" DOUBLE PRECISION,
  ADD COLUMN "webiscoData" TEXT,
  ADD COLUMN "fetchedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Prevent duplicate ref per ticket
CREATE UNIQUE INDEX "TicketOrder_ticketId_ref_key" ON "TicketOrder"("ticketId", "ref");

-- Fast lookup by order number across all tickets
CREATE INDEX "TicketOrder_ref_idx" ON "TicketOrder"("ref");
