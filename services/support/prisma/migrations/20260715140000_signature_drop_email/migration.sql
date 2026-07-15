-- Signature email is no longer user-editable; the outgoing address is always
-- the shared service@ mailbox (FROM_EMAIL env). Drop the per-user override.
ALTER TABLE "Signature" DROP COLUMN "email";
