-- ─────────────────────────────────────────────────────────────────────
-- RetoureItem.eanCode + Index
--
-- EAN/GTIN des Artikels, gefetched via Webisco-`artikelanfrage` beim
-- PDA-Lookup. Erlaubt dem Lager-Mitarbeiter den Artikel-Barcode mit
-- dem Q900-Scanner zu scannen und das Item automatisch als "received"
-- zu markieren — statt manueller Da/Fehlt-Buttons.
--
-- Nullable weil:
--   - Webisco führt nicht für jeden Artikel einen EAN
--   - alte Items (vor dieser Migration) haben keinen Wert
--   - Sammelartikel/Sets haben keine eindeutige EAN
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE "RetoureItem" ADD COLUMN "eanCode" TEXT;

CREATE INDEX "RetoureItem_eanCode_idx" ON "RetoureItem"("eanCode");
