-- ─────────────────────────────────────────────────────────────────────
-- RetoureCase.orderPositionsJson
--
-- Snapshot ALLER Positionen des Original-Belegs. Wird vom PDA-Scan-
-- Endpoint genutzt um zu klassifizieren: gescannter EAN gehört zur
-- Original-Order (= ok als Extra) oder ist Fremd-Artikel (= NOT OK).
--
-- Lazy populated — bestehende Cases bleiben mit "[]" und werden beim
-- ersten Scan-Bedarf via Webisco beleganfrage nachgeladen.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE "RetoureCase" ADD COLUMN "orderPositionsJson" TEXT NOT NULL DEFAULT '[]';
