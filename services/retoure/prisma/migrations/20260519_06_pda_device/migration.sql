-- ─────────────────────────────────────────────────────────────────────
-- PdaDevice — pro PDA-Gerät ein Eintrag mit eigenem Bearer-Token.
--
-- Erlaubt der `checkPdaAuth()`-Funktion, zwischen shared API_TOKEN
-- (env, Admin-Tests) und Per-Device-Tokens zu unterscheiden. Pairing-
-- Lifecycle siehe schema.prisma-Doku.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE "PdaDevice" (
    "id"               TEXT NOT NULL,
    "pdaId"            TEXT NOT NULL,
    "token"            TEXT NOT NULL,
    "active"           BOOLEAN NOT NULL DEFAULT TRUE,
    "pairingCode"      TEXT,
    "pairingExpiresAt" TIMESTAMP(3),
    "pairedAt"         TIMESTAMP(3),
    "lastSeenAt"       TIMESTAMP(3),
    "createdBy"        TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdaDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PdaDevice_pdaId_key"       ON "PdaDevice"("pdaId");
CREATE UNIQUE INDEX "PdaDevice_token_key"       ON "PdaDevice"("token");
CREATE UNIQUE INDEX "PdaDevice_pairingCode_key" ON "PdaDevice"("pairingCode");
CREATE        INDEX "PdaDevice_active_idx"      ON "PdaDevice"("active");
