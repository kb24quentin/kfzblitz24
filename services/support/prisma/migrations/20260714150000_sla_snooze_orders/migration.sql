-- Rename slaDueAt -> firstResponseDueAt
ALTER TABLE "Ticket" RENAME COLUMN "slaDueAt" TO "firstResponseDueAt";
DROP INDEX IF EXISTS "Ticket_slaDueAt_idx";
CREATE INDEX "Ticket_firstResponseDueAt_idx" ON "Ticket"("firstResponseDueAt");

-- Add resolutionDueAt (backfill: firstResponse + 48h → typical 24h/72h split)
ALTER TABLE "Ticket" ADD COLUMN "resolutionDueAt" TIMESTAMP(3);
UPDATE "Ticket" SET "resolutionDueAt" = "firstResponseDueAt" + interval '48 hours' WHERE "resolutionDueAt" IS NULL;
ALTER TABLE "Ticket" ALTER COLUMN "resolutionDueAt" SET NOT NULL;

-- Snooze fields
ALTER TABLE "Ticket" ADD COLUMN "snoozedUntil" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN "snoozedReason" TEXT;
CREATE INDEX "Ticket_snoozedUntil_idx" ON "Ticket"("snoozedUntil");

-- TicketOrder table
CREATE TABLE "TicketOrder" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TicketOrder_ticketId_idx" ON "TicketOrder"("ticketId");

ALTER TABLE "TicketOrder" ADD CONSTRAINT "TicketOrder_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
