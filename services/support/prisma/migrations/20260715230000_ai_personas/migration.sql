-- AI-Personas: fiktive "AI-Mitarbeiter" für Auto-Send-Signaturen.
-- Weight = relative auswahl-häufigkeit im weighted-random-pool.
CREATE TABLE "AiPersona" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL DEFAULT 'Kundenservice',
    "weight" INTEGER NOT NULL DEFAULT 10,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiPersona_pkey" PRIMARY KEY ("id")
);

-- AiDraft erweitert um scheduled-send (delay + cron-safety-net) + persona-link.
ALTER TABLE "AiDraft"
  ADD COLUMN "scheduledSendAt" TIMESTAMP(3),
  ADD COLUMN "aiPersonaId" TEXT;

CREATE INDEX "AiDraft_scheduledSendAt_idx" ON "AiDraft"("scheduledSendAt");

ALTER TABLE "AiDraft"
  ADD CONSTRAINT "AiDraft_aiPersonaId_fkey"
  FOREIGN KEY ("aiPersonaId") REFERENCES "AiPersona"("id") ON DELETE SET NULL ON UPDATE CASCADE;
