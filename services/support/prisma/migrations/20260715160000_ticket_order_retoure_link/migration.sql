-- Link TicketOrder to a Retoure-Case created via retoure /api/retoure/submit.
ALTER TABLE "TicketOrder"
  ADD COLUMN "retoureCaseId" TEXT,
  ADD COLUMN "retoureAnmeldungUrl" TEXT,
  ADD COLUMN "retoureLabelUrl" TEXT,
  ADD COLUMN "retoureCreatedAt" TIMESTAMP(3),
  ADD COLUMN "retoureFreeLabel" BOOLEAN NOT NULL DEFAULT false;
