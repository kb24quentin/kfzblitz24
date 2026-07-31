-- Kadenz: manuelles "Jetzt feuern" pro Kontakt.
-- Wenn gesetzt: nächster Cron-Tick ignoriert Delay + Sendefenster + Tageslimit
-- und feuert den aktuellen Step. Nach Ausführung wird das Feld wieder null gesetzt.
ALTER TABLE "CampaignContact" ADD COLUMN "forceFireAt" TIMESTAMP(3);
