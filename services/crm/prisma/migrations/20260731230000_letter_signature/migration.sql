-- Brief-Unterschriften (Bild-Signaturen für Briefe, wird zwischen
-- Grußformel und Name gerendert). Getrennt vom E-Mail-Signatur-Konzept
-- weil hier ein Bild (base64 PNG) statt HTML gebraucht wird.

CREATE TABLE "LetterSignature" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "imageData"  TEXT NOT NULL,           -- data:image/png;base64,...
  "signerName" TEXT,                    -- optional: Name unter dem Bild
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LetterSignature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LetterSignature_name_key" ON "LetterSignature"("name");

-- Template bekommt FK auf LetterSignature (nur bei type=letter genutzt)
ALTER TABLE "Template" ADD COLUMN "letterSignatureId" TEXT;
ALTER TABLE "Template"
  ADD CONSTRAINT "Template_letterSignatureId_fkey"
  FOREIGN KEY ("letterSignatureId") REFERENCES "LetterSignature"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
