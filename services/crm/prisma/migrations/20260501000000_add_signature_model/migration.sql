-- Promote signature from a Template-only column to a first-class managed
-- entity so users can create named signatures in Settings and re-use them
-- across multiple templates.

CREATE TABLE "Signature" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "html"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Signature_name_key" ON "Signature"("name");

-- Add FK column to Template
ALTER TABLE "Template" ADD COLUMN "signatureId" TEXT;

-- Migrate any existing inline signatures into Signature rows and link them.
-- Generates a deterministic id per template-with-signature so the migration
-- is idempotent if re-run on a clean DB. Names are derived from the template
-- name with a suffix to keep the unique constraint happy.
INSERT INTO "Signature" ("id", "name", "html", "createdAt", "updatedAt")
SELECT
  'migsig_' || substr(md5("id"), 1, 20)                AS "id",
  -- "<TemplateName> – Signatur" — keep it human readable
  "name" || ' – Signatur'                              AS "name",
  "signature"                                          AS "html",
  NOW()                                                AS "createdAt",
  NOW()                                                AS "updatedAt"
FROM "Template"
WHERE "signature" IS NOT NULL
  AND length(trim("signature")) > 0;

-- Link templates to their freshly-created signature rows
UPDATE "Template" t
SET "signatureId" = s."id"
FROM "Signature" s
WHERE t."signature" IS NOT NULL
  AND s."id" = 'migsig_' || substr(md5(t."id"), 1, 20);

-- Add foreign-key constraint
ALTER TABLE "Template"
  ADD CONSTRAINT "Template_signatureId_fkey"
  FOREIGN KEY ("signatureId") REFERENCES "Signature"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop the old inline column
ALTER TABLE "Template" DROP COLUMN "signature";
