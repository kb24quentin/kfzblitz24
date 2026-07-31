-- E-Mail-Template A wird optional: bei Kampagnen ohne E-Mail-Channel
-- (nur Brief oder nur Anruf) darf kein Template angegeben werden.
ALTER TABLE "Campaign" ALTER COLUMN "templateAId" DROP NOT NULL;
