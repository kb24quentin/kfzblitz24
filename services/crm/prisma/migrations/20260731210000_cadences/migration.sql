-- Cadences: multi-step sequences per campaign
-- 1) new tables
-- 2) new columns on Email/Letter/Reminder (stepId) + CampaignContact (progress + stop)
-- 3) data-migration: convert every existing campaign's flat channels/templates
--    into 1..3 CampaignStep rows (email → order 0, letter → 1, call → 2)
-- 4) safety: mark non-draft campaigns' contacts as stopped='migrated' so the new
--    cron doesn't re-fire something the old system already sent

-- ─── CampaignStep ──────────────────────────────────────────────────────────
CREATE TABLE "CampaignStep" (
  "id"                 TEXT NOT NULL,
  "campaignId"         TEXT NOT NULL,
  "order"              INTEGER NOT NULL,
  "channel"            TEXT NOT NULL,
  "triggerType"        TEXT NOT NULL DEFAULT 'relative',
  "delayDays"          INTEGER NOT NULL DEFAULT 0,
  "scheduledAt"        TIMESTAMP(3),
  "sendWindow"         TEXT,
  "maxPerDay"          INTEGER,
  "emailTemplateAId"   TEXT,
  "emailTemplateBId"   TEXT,
  "abSplitRatio"       INTEGER,
  "letterTemplateAId"  TEXT,
  "letterTemplateBId"  TEXT,
  "letterAbSplitRatio" INTEGER,
  "letterColor"        TEXT,
  "callNote"           TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignStep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CampaignStep_campaignId_order_key" ON "CampaignStep"("campaignId","order");
CREATE INDEX "CampaignStep_campaignId_idx" ON "CampaignStep"("campaignId");
ALTER TABLE "CampaignStep" ADD CONSTRAINT "CampaignStep_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignStep" ADD CONSTRAINT "CampaignStep_emailTemplateAId_fkey"
  FOREIGN KEY ("emailTemplateAId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignStep" ADD CONSTRAINT "CampaignStep_emailTemplateBId_fkey"
  FOREIGN KEY ("emailTemplateBId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignStep" ADD CONSTRAINT "CampaignStep_letterTemplateAId_fkey"
  FOREIGN KEY ("letterTemplateAId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignStep" ADD CONSTRAINT "CampaignStep_letterTemplateBId_fkey"
  FOREIGN KEY ("letterTemplateBId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── CampaignContactStep ───────────────────────────────────────────────────
CREATE TABLE "CampaignContactStep" (
  "id"                TEXT NOT NULL,
  "campaignContactId" TEXT NOT NULL,
  "stepId"            TEXT NOT NULL,
  "variant"           TEXT,
  "executedAt"        TIMESTAMP(3),
  "status"            TEXT NOT NULL DEFAULT 'executed',
  "skippedReason"     TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignContactStep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CampaignContactStep_campaignContactId_stepId_key" ON "CampaignContactStep"("campaignContactId","stepId");
ALTER TABLE "CampaignContactStep" ADD CONSTRAINT "CampaignContactStep_campaignContactId_fkey"
  FOREIGN KEY ("campaignContactId") REFERENCES "CampaignContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignContactStep" ADD CONSTRAINT "CampaignContactStep_stepId_fkey"
  FOREIGN KEY ("stepId") REFERENCES "CampaignStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── CampaignContact: progress + stop columns ──────────────────────────────
ALTER TABLE "CampaignContact" ADD COLUMN "currentStepIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CampaignContact" ADD COLUMN "lastStepAt"       TIMESTAMP(3);
ALTER TABLE "CampaignContact" ADD COLUMN "stopped"          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CampaignContact" ADD COLUMN "stoppedReason"    TEXT;
ALTER TABLE "CampaignContact" ADD COLUMN "stoppedAt"        TIMESTAMP(3);

-- ─── Email / Letter / Reminder: stepId + extras ────────────────────────────
ALTER TABLE "Email"    ADD COLUMN "stepId" TEXT;
ALTER TABLE "Email"    ADD CONSTRAINT "Email_stepId_fkey"
  FOREIGN KEY ("stepId") REFERENCES "CampaignStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Letter"   ADD COLUMN "stepId"  TEXT;
ALTER TABLE "Letter"   ADD COLUMN "variant" TEXT;
ALTER TABLE "Letter"   ADD COLUMN "color"   TEXT;
ALTER TABLE "Letter"   ADD CONSTRAINT "Letter_stepId_fkey"
  FOREIGN KEY ("stepId") REFERENCES "CampaignStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Reminder" ADD COLUMN "stepId" TEXT;
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_stepId_fkey"
  FOREIGN KEY ("stepId") REFERENCES "CampaignStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Data migration: convert existing campaigns to 1-step cadences ─────────
-- Email step at order 0 (when email channel active + template A set)
INSERT INTO "CampaignStep" (
  "id","campaignId","order","channel","triggerType","delayDays",
  "emailTemplateAId","emailTemplateBId","abSplitRatio","updatedAt"
)
SELECT
  'mig_' || substr(md5(c."id" || '_email'), 1, 20),
  c."id",
  0,
  'email',
  'relative',
  0,
  c."templateAId",
  c."templateBId",
  c."abSplitRatio",
  CURRENT_TIMESTAMP
FROM "Campaign" c
WHERE c."templateAId" IS NOT NULL
  AND c."channels" LIKE '%"email"%';

-- Letter step (order depends on whether email step exists)
INSERT INTO "CampaignStep" (
  "id","campaignId","order","channel","triggerType","delayDays",
  "letterTemplateAId","updatedAt"
)
SELECT
  'mig_' || substr(md5(c."id" || '_letter'), 1, 20),
  c."id",
  CASE
    WHEN c."templateAId" IS NOT NULL AND c."channels" LIKE '%"email"%'
    THEN 1 ELSE 0
  END,
  'letter',
  'relative',
  0,
  c."letterTemplateId",
  CURRENT_TIMESTAMP
FROM "Campaign" c
WHERE c."letterTemplateId" IS NOT NULL
  AND c."channels" LIKE '%"letter"%';

-- Call step (order after email + letter if both exist)
INSERT INTO "CampaignStep" (
  "id","campaignId","order","channel","triggerType","delayDays","updatedAt"
)
SELECT
  'mig_' || substr(md5(c."id" || '_call'), 1, 20),
  c."id",
  (CASE WHEN c."templateAId" IS NOT NULL AND c."channels" LIKE '%"email"%' THEN 1 ELSE 0 END) +
  (CASE WHEN c."letterTemplateId" IS NOT NULL AND c."channels" LIKE '%"letter"%' THEN 1 ELSE 0 END),
  'call',
  'relative',
  0,
  CURRENT_TIMESTAMP
FROM "Campaign" c
WHERE c."channels" LIKE '%"call"%';

-- Safety: for campaigns that were already active/paused/completed, stop all
-- their contacts so the new step-based cron does NOT re-fire anything the
-- old (queue-all-at-once) code already sent. Draft campaigns stay live.
UPDATE "CampaignContact" SET
  "stopped"       = true,
  "stoppedReason" = 'migrated',
  "stoppedAt"     = CURRENT_TIMESTAMP
WHERE "campaignId" IN (
  SELECT "id" FROM "Campaign" WHERE "status" != 'draft'
);
