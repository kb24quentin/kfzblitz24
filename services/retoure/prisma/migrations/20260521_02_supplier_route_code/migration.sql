-- ─────────────────────────────────────────────────────────────────────
-- Supplier.routeCode
--
-- Konfigurierbarer Routing-Code-String für das Container-Label
-- (Bereich "ROUTE", Format: "R## · ZIELORT"). Ersetzt den hard-coded
-- deriveRoute-Lookup in lib/label-pdf.ts. Wenn null bleibt, fällt der
-- Renderer auf den Namens-Slug zurück.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE "Supplier" ADD COLUMN "routeCode" TEXT;

UPDATE "Supplier" SET "routeCode" = 'R01 · INTERPARTS-PL'  WHERE "name" = 'Interparts';
UPDATE "Supplier" SET "routeCode" = 'R02 · AUTOPARTN-DE'   WHERE "name" = 'Autopartner';
UPDATE "Supplier" SET "routeCode" = 'R00 · KB24-INTERNAL'  WHERE "id"   = 'kfzblitz24-internal';
