-- ─────────────────────────────────────────────────────────────────────
-- Native-in-Shop Submit-Flow + Webhook-Infrastruktur
--
-- Erweitert RetoureCase + RetoureItem um Source/Kategorie/Eligibility-
-- Felder, fügt PendingPhoto + WebhookEndpoint + WebhookDelivery hinzu.
--
-- Backward-compatible: alle neuen Felder sind nullable oder haben
-- DEFAULTs, bestehende Cases bleiben unverändert.
-- ─────────────────────────────────────────────────────────────────────

-- ── RetoureCase: Source + Kategorie + Eligibility + Refund-Output ──
ALTER TABLE "RetoureCase"
  ADD COLUMN "source"          TEXT NOT NULL DEFAULT 'direct',
  ADD COLUMN "orderId"         TEXT,
  ADD COLUMN "kategorie"       TEXT NOT NULL DEFAULT 'widerruf',
  ADD COLUMN "kundenstatus"    TEXT NOT NULL DEFAULT 'privat',
  ADD COLUMN "eligibleUntil"   TIMESTAMP,
  ADD COLUMN "vehicleDataJson" TEXT,
  ADD COLUMN "gewaehrJson"     TEXT,
  ADD COLUMN "gutschriftNr"    TEXT,
  ADD COLUMN "tatsaechlicheErstattung" DOUBLE PRECISION;

CREATE INDEX "RetoureCase_source_idx"        ON "RetoureCase"("source");
CREATE INDEX "RetoureCase_kategorie_idx"     ON "RetoureCase"("kategorie");
CREATE INDEX "RetoureCase_eligibleUntil_idx" ON "RetoureCase"("eligibleUntil");
CREATE INDEX "RetoureCase_orderId_idx"       ON "RetoureCase"("orderId");

-- ── RetoureItem: Standardisierte Grund-Codes + Eigen-Fehler-Flag ──
ALTER TABLE "RetoureItem"
  ADD COLUMN "grundCode"               TEXT,
  ADD COLUMN "grundFreitext"           TEXT,
  ADD COLUMN "internalFault"           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "erstattungsbetragBrutto" DOUBLE PRECISION;

CREATE INDEX "RetoureItem_grundCode_idx" ON "RetoureItem"("grundCode");

-- ── PendingPhoto: Customer-Photos vor Submit (1h TTL) ──
CREATE TABLE "PendingPhoto" (
  "id"                TEXT PRIMARY KEY,
  "kind"              TEXT NOT NULL DEFAULT 'customer_submitted',
  "filename"          TEXT NOT NULL,
  "path"              TEXT NOT NULL,
  "mimeType"          TEXT NOT NULL,
  "sizeBytes"         INTEGER NOT NULL,
  "uploaderIp"        TEXT,
  "uploaderTokenHash" TEXT,
  "expiresAt"         TIMESTAMP NOT NULL,
  "createdAt"         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "PendingPhoto_expiresAt_idx" ON "PendingPhoto"("expiresAt");
CREATE INDEX "PendingPhoto_createdAt_idx" ON "PendingPhoto"("createdAt");

-- ── WebhookEndpoint: pro Source Empfänger-Konfig ──
CREATE TABLE "WebhookEndpoint" (
  "id"         TEXT PRIMARY KEY,
  "source"     TEXT NOT NULL UNIQUE,
  "url"        TEXT NOT NULL,
  "secret"     TEXT NOT NULL,
  "active"     BOOLEAN NOT NULL DEFAULT true,
  "allowedIps" TEXT,
  "events"     TEXT NOT NULL DEFAULT 'status_changed,refund_decided,case_canceled',
  "createdAt"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "WebhookEndpoint_source_idx" ON "WebhookEndpoint"("source");
CREATE INDEX "WebhookEndpoint_active_idx" ON "WebhookEndpoint"("active");

-- ── WebhookDelivery: pro Versuch ein Row ──
CREATE TABLE "WebhookDelivery" (
  "id"               TEXT PRIMARY KEY,
  "endpointId"       TEXT NOT NULL,
  "deliveryUuid"     TEXT NOT NULL UNIQUE,
  "caseId"           TEXT,
  "event"            TEXT NOT NULL,
  "payload"          TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'pending',
  "retryCount"       INTEGER NOT NULL DEFAULT 0,
  "scheduledAt"      TIMESTAMP NOT NULL,
  "nextRetryAt"      TIMESTAMP,
  "lastAttemptAt"    TIMESTAMP,
  "lastResponseCode" INTEGER,
  "lastResponseBody" TEXT,
  "ackBody"          TEXT,
  "createdAt"        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookDelivery_endpointId_fk"
    FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE
);

CREATE INDEX "WebhookDelivery_status_nextRetryAt_idx" ON "WebhookDelivery"("status", "nextRetryAt");
CREATE INDEX "WebhookDelivery_caseId_idx"             ON "WebhookDelivery"("caseId");
CREATE INDEX "WebhookDelivery_event_idx"              ON "WebhookDelivery"("event");
CREATE INDEX "WebhookDelivery_createdAt_idx"          ON "WebhookDelivery"("createdAt");
