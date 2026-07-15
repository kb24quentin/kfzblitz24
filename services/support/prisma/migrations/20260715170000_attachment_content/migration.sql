-- Extend Attachment for gmail-ingested attachments + inline-image (cid:) mapping.
ALTER TABLE "Attachment"
  ADD COLUMN "contentId" TEXT,
  ADD COLUMN "inline" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "content" BYTEA;

-- Indexes for message-scoped lookups and cid-mapping at ingest time.
CREATE INDEX "Attachment_messageId_idx" ON "Attachment"("messageId");
CREATE INDEX "Attachment_contentId_idx" ON "Attachment"("contentId");
