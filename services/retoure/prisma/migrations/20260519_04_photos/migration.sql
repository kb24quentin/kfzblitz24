-- ─────────────────────────────────────────────────────────────────────
-- Phase 5: RetoureItemPhoto — Foto-Uploads für die Wareneingangs-Prüfung
--
-- Speichert pro Foto die Metadaten (kind, mimeType, sizeBytes), den
-- relativen Pfad unter UPLOAD_DIR (typisch /app/uploads, gemountet auf
-- /opt/kfzblitz24/data/<env>/retoure-photos) sowie den OpenAI-Vision-
-- Score als JSON.
--
-- `caseId` ist denormalisiert: erlaubt PDA-/Admin-Listings nach Case
-- ohne Join über RetoureItem. Cascade-Delete folgt der Item-Cascade
-- (Items werden bei Case-Delete schon kaskadiert).
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE "RetoureItemPhoto" (
    "id"             TEXT NOT NULL,
    "itemId"         TEXT NOT NULL,
    "caseId"         TEXT NOT NULL,
    "kind"           TEXT NOT NULL,
    "filename"       TEXT NOT NULL,
    "path"           TEXT NOT NULL,
    "mimeType"       TEXT NOT NULL,
    "sizeBytes"      INTEGER NOT NULL,
    "aiAnalysisJson" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetoureItemPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RetoureItemPhoto_itemId_idx" ON "RetoureItemPhoto"("itemId");
CREATE INDEX "RetoureItemPhoto_caseId_idx" ON "RetoureItemPhoto"("caseId");
CREATE INDEX "RetoureItemPhoto_kind_idx"   ON "RetoureItemPhoto"("kind");

ALTER TABLE "RetoureItemPhoto"
  ADD CONSTRAINT "RetoureItemPhoto_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "RetoureItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
