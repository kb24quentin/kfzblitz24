-- Add code column (nullable initially so we can backfill)
ALTER TABLE "Ticket" ADD COLUMN "code" TEXT;

-- Backfill existing rows with random 6-char codes.
-- md5+substring gives 16^6 = 16M possible codes; for ~22 existing rows collision probability is ~0.0014%
-- (birthday paradox). Charset here is 0-9 + A-F, slightly wider than the app's generator
-- (which excludes ambiguous chars) but backfill only runs once per row so mismatched charsets are OK.
UPDATE "Ticket"
SET "code" = UPPER(substring(md5(id || random()::text || clock_timestamp()::text) from 1 for 6));

-- Enforce not-null + unique
ALTER TABLE "Ticket" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Ticket_code_key" ON "Ticket"("code");
