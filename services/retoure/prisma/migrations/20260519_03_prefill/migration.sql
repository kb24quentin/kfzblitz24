-- ─────────────────────────────────────────────────────────────────────
-- Phase 9: RetourePrefill — Hand-off-Token vom Shop (z.B. Shopware)
--
-- Speichert kurzlebige (TTL ≈ 15 Min) Prefill-Daten, die ein Shop-Plugin
-- via POST /api/retoure/prefill anlegt. Der Kunde landet dann auf
-- /start?token=… und sieht eine vorausgefüllte Retoure-Anmeldung.
--
-- Bewusst KEINE Foreign Keys auf RetoureCase — viele Prefills werden
-- nie in einen Case münden (Kunde bricht ab). Das ist beabsichtigt.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE "RetourePrefill" (
    "id"            TEXT NOT NULL,
    "token"         TEXT NOT NULL,
    "bestellnummer" TEXT NOT NULL,
    "payloadJson"   TEXT NOT NULL,
    "source"        TEXT,
    "expiresAt"     TIMESTAMP(3) NOT NULL,
    "consumedAt"    TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetourePrefill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RetourePrefill_token_key"       ON "RetourePrefill"("token");
CREATE        INDEX "RetourePrefill_token_idx"       ON "RetourePrefill"("token");
CREATE        INDEX "RetourePrefill_expiresAt_idx"   ON "RetourePrefill"("expiresAt");
