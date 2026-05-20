-- ─────────────────────────────────────────────────────────────────────
-- RetoureCase.additionalTrackings
--
-- Multi-Paket-Szenarien: eine Retoure kann auf mehrere Pakete verteilt
-- sein (z. B. 5 Items in 2 Boxen, oder ein Karton kommt am nächsten
-- Tag nach). Wir speichern die Zusatz-Tracking-Nummern als JSON-Array
-- damit der PDA-Worker dieselbe Retoure mit weiteren Paket-Labels
-- verknüpfen kann.
--
-- Primary tracking bleibt customerTrackingNumber bzw. dhlTrackingNumber.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE "RetoureCase" ADD COLUMN "additionalTrackings" TEXT NOT NULL DEFAULT '[]';
