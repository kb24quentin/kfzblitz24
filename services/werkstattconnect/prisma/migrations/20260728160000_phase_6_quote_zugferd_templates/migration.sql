-- Phase 6: Quote + Briefpapier-Templates + Footer-Cols + km-tracking

-- Workshop: erweiterter briefpapier-editor + quote-numbering + preise
ALTER TABLE "Workshop" ADD COLUMN "brandAccent"         TEXT;
ALTER TABLE "Workshop" ADD COLUMN "footerCol1"          TEXT;
ALTER TABLE "Workshop" ADD COLUMN "footerCol2"          TEXT;
ALTER TABLE "Workshop" ADD COLUMN "footerCol3"          TEXT;
ALTER TABLE "Workshop" ADD COLUMN "letterheadTemplate"  TEXT NOT NULL DEFAULT 'modern-orange';
ALTER TABLE "Workshop" ADD COLUMN "quotePrefix"         TEXT NOT NULL DEFAULT 'AN-';
ALTER TABLE "Workshop" ADD COLUMN "quoteNumberYear"     INT;
ALTER TABLE "Workshop" ADD COLUMN "quoteNumberLast"     INT NOT NULL DEFAULT 0;
ALTER TABLE "Workshop" ADD COLUMN "hourlyRateCent"      INT NOT NULL DEFAULT 9500;
ALTER TABLE "Workshop" ADD COLUMN "partsMarkupPercent"  INT NOT NULL DEFAULT 15;

-- ServiceItem: stundenbasiert + kategorie
ALTER TABLE "ServiceItem" ADD COLUMN "category"   TEXT;
ALTER TABLE "ServiceItem" ADD COLUMN "laborHours" DOUBLE PRECISION;
ALTER TABLE "ServiceItem" ALTER COLUMN "netPriceCent" SET DEFAULT 0;
CREATE INDEX "ServiceItem_workshopId_category_idx" ON "ServiceItem"("workshopId","category");

-- Invoice: km-stand-tracking
ALTER TABLE "Invoice" ADD COLUMN "mileageAtIssue" INT;

-- Quote (angebot)
CREATE TABLE "Quote" (
    "id"                    TEXT NOT NULL,
    "workshopId"            TEXT NOT NULL,
    "quoteNumber"           TEXT NOT NULL,
    "customerId"            TEXT NOT NULL,
    "vehicleId"             TEXT,
    "mileageAtIssue"        INT,
    "issuedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil"            TIMESTAMP(3),
    "positions"             JSONB NOT NULL,
    "subtotalNetCent"       INT NOT NULL,
    "totalVatCent"          INT NOT NULL,
    "totalGrossCent"        INT NOT NULL,
    "status"                TEXT NOT NULL DEFAULT 'draft',
    "acceptedAt"            TIMESTAMP(3),
    "rejectedAt"            TIMESTAMP(3),
    "convertedAt"           TIMESTAMP(3),
    "convertedToInvoiceId"  TEXT,
    "notes"                 TEXT,
    "createdBy"             TEXT,
    "pdfBytes"              BYTEA,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_workshopId_fkey"           FOREIGN KEY ("workshopId")           REFERENCES "Workshop"("id")     ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey"           FOREIGN KEY ("customerId")           REFERENCES "Customer"("id")     ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_vehicleId_fkey"            FOREIGN KEY ("vehicleId")            REFERENCES "Vehicle"("id")      ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_createdBy_fkey"            FOREIGN KEY ("createdBy")            REFERENCES "WorkshopUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_convertedToInvoiceId_fkey" FOREIGN KEY ("convertedToInvoiceId") REFERENCES "Invoice"("id")      ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Quote_workshopId_issuedAt_idx" ON "Quote"("workshopId","issuedAt");
CREATE INDEX "Quote_workshopId_status_idx"   ON "Quote"("workshopId","status");
