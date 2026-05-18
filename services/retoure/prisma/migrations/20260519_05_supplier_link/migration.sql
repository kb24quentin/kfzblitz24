-- ─────────────────────────────────────────────────────────────────────
-- Phase 6 (Erweiterung): Container ↔ Lieferanten-Bindung
--
-- Geschäftsregel: "Ein Container ist immer Lieferanten-rein."
-- kfzBlitz24 hat nur eine kleine Zahl echter Distributoren (aktuell:
-- Interparts, Autopartner). Webisco liefert pro Position nur die
-- TecDoc-Einspeiser-ID (= Hersteller, z. B. BMW/MANN/Osram) — NICHT den
-- Distributor. Das heißt: der Supplier-Link wird nicht aus Webisco
-- abgeleitet, sondern beim "Item auf Container legen" vom Container
-- vererbt (der PDA-Mitarbeiter wählt den Supplier bei Container-Anlage).
--
--   1. Container bekommt `supplierId` (nullable). Bei Neuanlage über die
--      PDA-API ist dieses Feld Pflicht; das wird in der Anwendungs-Schicht
--      erzwungen, nicht im DB-Schema (so dass alte Container ohne
--      Supplier weiter existieren können).
--
--   2. RetoureItem bekommt sowohl `einspeiserid` (Snapshot aus Webisco-
--      Position, = Hersteller-ID) als auch `supplierId` (FK auf Supplier,
--      gefüllt beim Linking ans Container). `einspeiserid` bleibt als
--      Hersteller-Snapshot für spätere Pivots erhalten.
--
-- FKs auf Supplier sind ON DELETE SET NULL, weil das Löschen eines
-- Lieferanten nicht die historischen Cases/Container zerstören soll.
-- ─────────────────────────────────────────────────────────────────────

-- ── Container.supplierId ───────────────────────────────────────────────
ALTER TABLE "Container"
  ADD COLUMN "supplierId" TEXT;

CREATE INDEX "Container_supplierId_idx" ON "Container"("supplierId");

ALTER TABLE "Container"
  ADD CONSTRAINT "Container_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── RetoureItem.einspeiserid + RetoureItem.supplierId ──────────────────
ALTER TABLE "RetoureItem"
  ADD COLUMN "einspeiserid" INTEGER,
  ADD COLUMN "supplierId"   TEXT;

CREATE INDEX "RetoureItem_einspeiserid_idx" ON "RetoureItem"("einspeiserid");
CREATE INDEX "RetoureItem_supplierId_idx"   ON "RetoureItem"("supplierId");

ALTER TABLE "RetoureItem"
  ADD CONSTRAINT "RetoureItem_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
