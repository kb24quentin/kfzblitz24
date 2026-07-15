-- Manual message-edit audit fields. Editing changes ONLY the ticket-thread
-- display (the customer already received the original via Resend/Gmail).
ALTER TABLE "Message"
  ADD COLUMN "editedAt" TIMESTAMP(3),
  ADD COLUMN "editedById" TEXT;
