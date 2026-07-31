-- Multi-channel campaigns + Letter model for OnlineBrief24 sends.

-- Campaign gets a channels field (JSON array of "email"|"letter"|"call").
-- Default: email only, so existing campaigns keep sending mail.
ALTER TABLE "Campaign"
  ADD COLUMN "channels" TEXT NOT NULL DEFAULT '["email"]';

-- Letter table — one row per contact per campaign that got a letter.
CREATE TABLE "Letter" (
  "id"           TEXT NOT NULL,
  "campaignId"   TEXT,
  "contactId"    TEXT NOT NULL,
  "templateId"   TEXT,
  "subject"      TEXT NOT NULL,
  "body"         TEXT NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'queued',
  "ob24JobId"    INTEGER,
  "ob24Mode"     TEXT,
  "pages"        INTEGER,
  "amount"       DOUBLE PRECISION,
  "trackingCode" TEXT,
  "sentAt"       TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Letter_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Letter_campaignId_status_idx" ON "Letter"("campaignId", "status");
CREATE INDEX "Letter_contactId_idx" ON "Letter"("contactId");

ALTER TABLE "Letter"
  ADD CONSTRAINT "Letter_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Letter"
  ADD CONSTRAINT "Letter_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Letter"
  ADD CONSTRAINT "Letter_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "Template"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
