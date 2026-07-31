-- Postanschrift für Contact — Voraussetzung für Brief-Versand.
-- Alle Felder nullable (bestehende Rows bleiben unangetastet).
-- country defaultet auf "DE" für neue Rows.
ALTER TABLE "Contact" ADD COLUMN "street"      TEXT;
ALTER TABLE "Contact" ADD COLUMN "houseNumber" TEXT;
ALTER TABLE "Contact" ADD COLUMN "zipCode"     TEXT;
ALTER TABLE "Contact" ADD COLUMN "country"     TEXT DEFAULT 'DE';
