-- Optional Reply-To auf Sender: darf eine externe Adresse (nicht auf
-- Resend-Domain) sein, weil Reply-To nur als Header mitläuft und nicht
-- zum Senden verwendet wird.
ALTER TABLE "Sender" ADD COLUMN "replyTo" TEXT;
