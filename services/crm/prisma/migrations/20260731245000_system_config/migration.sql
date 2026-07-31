-- Single-row SystemConfig (aktuell nur OB24-Modus) + kurzlebige
-- PendingAdminAction für Re-Auth-Flows.

CREATE TABLE "SystemConfig" (
  "id"             TEXT NOT NULL,
  "ob24Mode"       TEXT NOT NULL DEFAULT 'test',
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  "updatedByEmail" TEXT,
  CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- Seed die einzige Zeile mit 'test'. Prod-Admin kann anschließend
-- via Settings-UI umschalten (mit Google-Re-Auth).
INSERT INTO "SystemConfig" ("id", "ob24Mode", "updatedAt")
VALUES ('singleton', 'test', CURRENT_TIMESTAMP);

CREATE TABLE "PendingAdminAction" (
  "id"        TEXT NOT NULL,
  "userEmail" TEXT NOT NULL,
  "action"    TEXT NOT NULL,
  "payload"   TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PendingAdminAction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PendingAdminAction_expiresAt_idx" ON "PendingAdminAction"("expiresAt");
