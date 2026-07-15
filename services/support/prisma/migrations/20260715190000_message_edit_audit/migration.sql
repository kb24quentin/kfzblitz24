-- Manual message-edit audit fields. Editing changes ONLY the ticket-thread
-- display (the customer already received the original via Resend/Gmail).
--
-- NOTE: This migration was deployed to prod but the feature was reverted
-- because it broke history integrity. The following migration
-- (20260715200000_message_drop_edit_audit) drops these columns again.
-- Both migrations are kept in history to preserve prisma migration state.
ALTER TABLE "Message"
  ADD COLUMN "editedAt" TIMESTAMP(3),
  ADD COLUMN "editedById" TEXT;
