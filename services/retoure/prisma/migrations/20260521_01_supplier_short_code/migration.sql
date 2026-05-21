-- ─────────────────────────────────────────────────────────────────────
-- Supplier.shortCode
--
-- Configurable 2-4 char Container-Code-Prefix pro Lieferant. Ersetzt
-- die hard-coded SUPPLIER_SHORT_CODES Map in lib/containers.ts. Wenn
-- shortCode null ist, leitet `supplierShortCode()` aus dem Namen ab
-- (erste 2 Großbuchstaben, wie vorher als Fallback).
--
-- Seed: bekannte Lieferanten kriegen ihren bisherigen Kürzel direkt
-- gesetzt, damit existierende Container-Codes (IP-001, KB-007, ...)
-- weiter zur richtigen Sequenz gehören.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE "Supplier" ADD COLUMN "shortCode" TEXT;

-- Wichtig: Namen exakt wie sie in der DB stehen. Falls Name in der
-- Realität anders ist (z. B. "kfzBlitz24 Intern" statt
-- "kfzBlitz24 Retoure (intern)"), updaten wir trotzdem per id für die
-- internal-Sammelpalette.
UPDATE "Supplier" SET "shortCode" = 'IP' WHERE "name" = 'Interparts';
UPDATE "Supplier" SET "shortCode" = 'AP' WHERE "name" = 'Autopartner';
UPDATE "Supplier" SET "shortCode" = 'KB' WHERE "id" = 'kfzblitz24-internal';
