-- ─────────────────────────────────────────────────────────────────────
-- RetoureCase.scanCompletedAt
--
-- Timestamp wann der Lager-Mitarbeiter im PDA "Fertig mit Scannen"
-- tappt. Vorher bleibt der Wizard im SCAN-Step, damit Extras + Wrong-
-- Items noch gescannt werden können, auch wenn alle angemeldeten Items
-- bereits received sind.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE "RetoureCase" ADD COLUMN "scanCompletedAt" TIMESTAMP(3);
