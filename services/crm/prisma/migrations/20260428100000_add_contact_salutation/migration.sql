-- Add salutation (Anrede) — "Herr" or "Frau". Nullable so existing rows
-- aren't broken; the form requires it for new contacts.
ALTER TABLE "Contact" ADD COLUMN "salutation" TEXT;
