-- Managed sender addresses (Absender) users can pick per-campaign.
CREATE TABLE "Sender" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Sender_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Sender_email_key" ON "Sender"("email");

-- Campaign gets: sender FK (nullable → falls back to env) + scheduledAt
ALTER TABLE "Campaign" ADD COLUMN "senderId"    TEXT;
ALTER TABLE "Campaign" ADD COLUMN "scheduledAt" TIMESTAMP(3);
ALTER TABLE "Campaign"
  ADD CONSTRAINT "Campaign_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "Sender"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
