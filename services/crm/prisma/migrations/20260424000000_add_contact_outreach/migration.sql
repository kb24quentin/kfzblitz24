-- Add outreach identifier so we can exclude in-person ("local") contacts
-- from email campaigns. Default 'remote' for all existing rows so the
-- current behaviour is preserved.
ALTER TABLE "Contact" ADD COLUMN "outreach" TEXT NOT NULL DEFAULT 'remote';
