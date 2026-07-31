-- Template bekommt einen Typ (email vs letter) + optionalen P.S.-Text
-- für Brief-Templates.
ALTER TABLE "Template" ADD COLUMN "type"     TEXT NOT NULL DEFAULT 'email';
ALTER TABLE "Template" ADD COLUMN "letterPs" TEXT;

-- Campaign kann pro Brief-Kanal ein eigenes Template referenzieren
-- (separat vom email templateAId).
ALTER TABLE "Campaign" ADD COLUMN "letterTemplateId" TEXT;
ALTER TABLE "Campaign"
  ADD CONSTRAINT "Campaign_letterTemplateId_fkey"
  FOREIGN KEY ("letterTemplateId") REFERENCES "Template"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
