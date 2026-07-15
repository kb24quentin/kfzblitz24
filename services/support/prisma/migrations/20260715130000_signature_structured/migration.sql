-- Add structured columns (nullable first, backfill, then NOT NULL, then drop legacy html/name).
ALTER TABLE "Signature" ADD COLUMN "displayName" TEXT;
ALTER TABLE "Signature" ADD COLUMN "position" TEXT;
ALTER TABLE "Signature" ADD COLUMN "email" TEXT;

-- Backfill from linked User row. Admins get "Administrator", everyone else "Kundenservice".
UPDATE "Signature" s
SET
  "displayName" = COALESCE(u.name, 'Team'),
  "position" = CASE WHEN u.role = 'admin' THEN 'Administrator' ELSE 'Kundenservice' END,
  "email" = u.email
FROM "User" u
WHERE s."userId" = u.id;

ALTER TABLE "Signature" ALTER COLUMN "displayName" SET NOT NULL;
ALTER TABLE "Signature" ALTER COLUMN "position" SET NOT NULL;
ALTER TABLE "Signature" ALTER COLUMN "email" SET NOT NULL;

-- Drop legacy freeform html + signature-label. All users now share the fixed brand template.
ALTER TABLE "Signature" DROP COLUMN "html";
ALTER TABLE "Signature" DROP COLUMN "name";
