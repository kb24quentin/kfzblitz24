-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "firstName" TEXT;
ALTER TABLE "Contact" ADD COLUMN "lastName" TEXT;

-- Backfill firstName/lastName from existing name: last token = lastName, rest = firstName
UPDATE "Contact"
SET
  "firstName" = TRIM(BOTH FROM regexp_replace("name", '\s+\S+\s*$', '')),
  "lastName"  = TRIM(BOTH FROM regexp_replace("name", '^.*\s', ''))
WHERE "name" IS NOT NULL AND "name" != '' AND "name" LIKE '% %';

-- One-word names: put whole thing in firstName
UPDATE "Contact"
SET "firstName" = TRIM(BOTH FROM "name")
WHERE "name" IS NOT NULL AND "name" != '' AND "name" NOT LIKE '% %';
