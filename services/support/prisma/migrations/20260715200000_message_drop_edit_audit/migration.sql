-- Revert the edit-audit fields — the message-edit feature was removed
-- because editing sent messages would break the history/audit integrity
-- of the ticket thread. The customer already received the original mail;
-- letting agents rewrite it locally creates a false record of what was
-- actually communicated.
ALTER TABLE "Message"
  DROP COLUMN IF EXISTS "editedAt",
  DROP COLUMN IF EXISTS "editedById";
