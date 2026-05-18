-- SLA-Felder am Case
ALTER TABLE "RetoureCase"
  ADD COLUMN "carrierDeliveredAt" TIMESTAMP(3),
  ADD COLUMN "partnerReceivedAt"  TIMESTAMP(3);

CREATE INDEX "RetoureCase_carrierDeliveredAt_idx" ON "RetoureCase"("carrierDeliveredAt");
CREATE INDEX "RetoureCase_partnerReceivedAt_idx"  ON "RetoureCase"("partnerReceivedAt");

-- Item-Level Tracking-Tabelle
CREATE TABLE "RetoureItem" (
    "id"            TEXT NOT NULL,
    "caseId"        TEXT NOT NULL,
    "source"        TEXT NOT NULL DEFAULT 'registered',
    "status"        TEXT NOT NULL DEFAULT 'pending',
    "artikelnummer" TEXT,
    "hersteller"    TEXT,
    "beschreibung"  TEXT,
    "menge"         INTEGER NOT NULL DEFAULT 1,
    "grund"         TEXT,
    "einzelpreis_brutto"  DOUBLE PRECISION,
    "gesamtpreis_brutto"  DOUBLE PRECISION,
    "einzelgewicht_g"     INTEGER,
    "einkaufspreis_brutto" DOUBLE PRECISION,
    "receivedAt"    TIMESTAMP(3),
    "receivedByPda" TEXT,
    "scanCount"     INTEGER NOT NULL DEFAULT 0,
    "employeeScore" INTEGER,
    "aiScore"       INTEGER,
    "combinedScore" INTEGER,
    "verdict"       TEXT,
    "verdictReason" TEXT,
    "scoredAt"      TIMESTAMP(3),
    "photoCount"    INTEGER NOT NULL DEFAULT 0,
    "containerId"   TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetoureItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RetoureItem_caseId_idx"      ON "RetoureItem"("caseId");
CREATE INDEX "RetoureItem_status_idx"      ON "RetoureItem"("status");
CREATE INDEX "RetoureItem_source_idx"      ON "RetoureItem"("source");
CREATE INDEX "RetoureItem_containerId_idx" ON "RetoureItem"("containerId");
CREATE INDEX "RetoureItem_verdict_idx"     ON "RetoureItem"("verdict");

ALTER TABLE "RetoureItem"
  ADD CONSTRAINT "RetoureItem_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "RetoureCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: bestehende Cases haben Items als JSON in RetoureCase.itemsJson —
-- in einzelne RetoureItem-Rows aufdröseln (source=registered).
INSERT INTO "RetoureItem" (
  "id", "caseId", "source", "status",
  "artikelnummer", "hersteller", "beschreibung",
  "menge", "grund",
  "einzelpreis_brutto", "gesamtpreis_brutto", "einzelgewicht_g",
  "createdAt", "updatedAt"
)
SELECT
  -- 25-char cuid-ähnliche ID (good enough — produktive Cases sind erst 1)
  'itm_' || substr(md5(random()::text || c."id" || (it.ordinality)::text), 1, 21),
  c."id",
  'registered',
  'pending',
  it.value->>'artikelnummer',
  it.value->>'hersteller',
  it.value->>'beschreibung',
  COALESCE((it.value->>'menge')::int, 1),
  it.value->>'grund',
  NULLIF(it.value->>'einzelpreis_brutto', '')::double precision,
  NULLIF(it.value->>'gesamtpreis_brutto', '')::double precision,
  NULLIF(it.value->>'einzelgewicht_g', '')::int,
  c."createdAt",
  c."updatedAt"
FROM "RetoureCase" c,
     LATERAL jsonb_array_elements(c."itemsJson"::jsonb) WITH ORDINALITY AS it(value, ordinality)
WHERE c."itemsJson" IS NOT NULL
  AND c."itemsJson" <> ''
  AND c."itemsJson" <> '[]';
