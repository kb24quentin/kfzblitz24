-- ================================================================
-- Phase 3+4+5: Kunden/Fahrzeuge + Kalender/Reminder + Rechnungen/GoBD
-- ================================================================

-- ---------- Workshop-Erweiterungen (briefpapier + rechnungs-numbering) ----------
ALTER TABLE "Workshop" ADD COLUMN "letterheadLogo"     BYTEA;
ALTER TABLE "Workshop" ADD COLUMN "letterheadLogoMime" TEXT;
ALTER TABLE "Workshop" ADD COLUMN "brandPrimary"       TEXT;
ALTER TABLE "Workshop" ADD COLUMN "brandFooterText"    TEXT;
ALTER TABLE "Workshop" ADD COLUMN "iban"               TEXT;
ALTER TABLE "Workshop" ADD COLUMN "bic"                TEXT;
ALTER TABLE "Workshop" ADD COLUMN "bankName"           TEXT;
ALTER TABLE "Workshop" ADD COLUMN "invoicePrefix"      TEXT NOT NULL DEFAULT 'RE-';
ALTER TABLE "Workshop" ADD COLUMN "invoiceNumberYear"  INT;
ALTER TABLE "Workshop" ADD COLUMN "invoiceNumberLast"  INT NOT NULL DEFAULT 0;

-- ---------- Customer (bestehendes MVP-placeholder um alle felder erweitern) ----
ALTER TABLE "Customer" ADD COLUMN "type"        TEXT NOT NULL DEFAULT 'b2c';
ALTER TABLE "Customer" ADD COLUMN "companyName" TEXT;
ALTER TABLE "Customer" ADD COLUMN "firstName"   TEXT;
ALTER TABLE "Customer" ADD COLUMN "lastName"    TEXT;
ALTER TABLE "Customer" ADD COLUMN "email"       TEXT;
ALTER TABLE "Customer" ADD COLUMN "phone"       TEXT;
ALTER TABLE "Customer" ADD COLUMN "street"      TEXT;
ALTER TABLE "Customer" ADD COLUMN "zip"         TEXT;
ALTER TABLE "Customer" ADD COLUMN "city"        TEXT;
ALTER TABLE "Customer" ADD COLUMN "country"     TEXT NOT NULL DEFAULT 'DEU';
ALTER TABLE "Customer" ADD COLUMN "taxId"       TEXT;
ALTER TABLE "Customer" ADD COLUMN "notes"       TEXT;
ALTER TABLE "Customer" ADD COLUMN "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "Customer_workshopId_lastName_idx" ON "Customer"("workshopId","lastName");

-- ---------- Vehicle ----------
CREATE TABLE "Vehicle" (
    "id"                TEXT NOT NULL,
    "workshopId"        TEXT NOT NULL,
    "customerId"        TEXT NOT NULL,
    "licensePlate"      TEXT,
    "vin"               TEXT,
    "brand"             TEXT,
    "model"             TEXT,
    "variant"           TEXT,
    "year"              INT,
    "hsn"               TEXT,
    "tsn"               TEXT,
    "fuelType"          TEXT,
    "transmission"      TEXT,
    "power"             INT,
    "color"             TEXT,
    "firstRegistration" TIMESTAMP(3),
    "mileage"           INT,
    "mileageUpdatedAt"  TIMESTAMP(3),
    "nextTuev"          TIMESTAMP(3),
    "nextInspection"    TIMESTAMP(3),
    "notes"             TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Vehicle_workshopId_idx"                     ON "Vehicle"("workshopId");
CREATE INDEX "Vehicle_customerId_idx"                     ON "Vehicle"("customerId");
CREATE INDEX "Vehicle_workshopId_licensePlate_idx"        ON "Vehicle"("workshopId","licensePlate");

-- ---------- Appointment ----------
CREATE TABLE "Appointment" (
    "id"          TEXT NOT NULL,
    "workshopId"  TEXT NOT NULL,
    "customerId"  TEXT NOT NULL,
    "vehicleId"   TEXT,
    "mechanicId"  TEXT,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "startsAt"    TIMESTAMP(3) NOT NULL,
    "endsAt"      TIMESTAMP(3) NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_vehicleId_fkey"  FOREIGN KEY ("vehicleId")  REFERENCES "Vehicle"("id")  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "WorkshopUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Appointment_workshopId_startsAt_idx"             ON "Appointment"("workshopId","startsAt");
CREATE INDEX "Appointment_workshopId_mechanicId_startsAt_idx"  ON "Appointment"("workshopId","mechanicId","startsAt");

-- ---------- Reminder ----------
CREATE TABLE "Reminder" (
    "id"               TEXT NOT NULL,
    "workshopId"       TEXT NOT NULL,
    "customerId"       TEXT NOT NULL,
    "vehicleId"        TEXT,
    "type"             TEXT NOT NULL,
    "title"            TEXT NOT NULL,
    "note"             TEXT,
    "dueDate"          TIMESTAMP(3) NOT NULL,
    "notifyDaysBefore" INT NOT NULL DEFAULT 30,
    "status"           TEXT NOT NULL DEFAULT 'pending',
    "sentAt"           TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_vehicleId_fkey"  FOREIGN KEY ("vehicleId")  REFERENCES "Vehicle"("id")  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Reminder_workshopId_status_dueDate_idx" ON "Reminder"("workshopId","status","dueDate");

-- ---------- ServiceItem ----------
CREATE TABLE "ServiceItem" (
    "id"           TEXT NOT NULL,
    "workshopId"   TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "description"  TEXT,
    "netPriceCent" INT NOT NULL,
    "vatPercent"   INT NOT NULL DEFAULT 19,
    "unit"         TEXT NOT NULL DEFAULT 'Stk',
    "active"       BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceItem_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ServiceItem" ADD CONSTRAINT "ServiceItem_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ServiceItem_workshopId_active_idx" ON "ServiceItem"("workshopId","active");

-- ---------- Invoice ----------
CREATE TABLE "Invoice" (
    "id"              TEXT NOT NULL,
    "workshopId"      TEXT NOT NULL,
    "invoiceNumber"   TEXT NOT NULL,
    "customerId"      TEXT NOT NULL,
    "vehicleId"       TEXT,
    "issuedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt"           TIMESTAMP(3),
    "positions"       JSONB NOT NULL,
    "subtotalNetCent" INT NOT NULL,
    "totalVatCent"    INT NOT NULL,
    "totalGrossCent"  INT NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'draft',
    "paidAt"          TIMESTAMP(3),
    "cancelledAt"     TIMESTAMP(3),
    "cancelledById"   TEXT,
    "notes"           TEXT,
    "createdBy"       TEXT,
    "pdfBytes"        BYTEA,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_vehicleId_fkey"  FOREIGN KEY ("vehicleId")  REFERENCES "Vehicle"("id")  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdBy_fkey"  FOREIGN KEY ("createdBy")  REFERENCES "WorkshopUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Invoice_workshopId_issuedAt_idx" ON "Invoice"("workshopId","issuedAt");
CREATE INDEX "Invoice_workshopId_status_idx"   ON "Invoice"("workshopId","status");

-- ---------- InvoiceJournalEntry (GoBD-audit-trail, immutable) ----------
CREATE TABLE "InvoiceJournalEntry" (
    "id"            TEXT NOT NULL,
    "workshopId"    TEXT NOT NULL,
    "invoiceId"     TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "event"         TEXT NOT NULL,
    "actorId"       TEXT,
    "actorEmail"    TEXT,
    "actorName"     TEXT,
    "payload"       JSONB NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceJournalEntry_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "InvoiceJournalEntry" ADD CONSTRAINT "InvoiceJournalEntry_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceJournalEntry" ADD CONSTRAINT "InvoiceJournalEntry_invoiceId_fkey"  FOREIGN KEY ("invoiceId")  REFERENCES "Invoice"("id")  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "InvoiceJournalEntry_workshopId_invoiceId_idx" ON "InvoiceJournalEntry"("workshopId","invoiceId");
CREATE INDEX "InvoiceJournalEntry_invoiceNumber_idx"        ON "InvoiceJournalEntry"("invoiceNumber");
