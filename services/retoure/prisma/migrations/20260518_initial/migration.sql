-- CreateTable
CREATE TABLE "RetoureCase" (
    "id" TEXT NOT NULL,
    "externalRef" TEXT,
    "bestellnummer" TEXT NOT NULL,
    "belegId" TEXT,
    "belegnummer" TEXT,
    "belegdatum" TEXT,
    "customerAnrede" TEXT,
    "customerVorname" TEXT,
    "customerName" TEXT,
    "customerStrasse" TEXT,
    "customerPlz" TEXT,
    "customerOrt" TEXT,
    "customerEmail" TEXT,
    "customerTelefon" TEXT,
    "customerHandy" TEXT,
    "itemsJson" TEXT NOT NULL DEFAULT '[]',
    "warenwertBrutto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "labelFeeBrutto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "voraussichtlicheErstattung" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shippingMode" TEXT NOT NULL DEFAULT 'standard',
    "labelRequested" BOOLEAN NOT NULL DEFAULT false,
    "labelPaid" BOOLEAN NOT NULL DEFAULT false,
    "dhlShipmentId" INTEGER,
    "dhlTrackingNumber" TEXT,
    "dhlRetoureIdc" TEXT,
    "weightSentKg" DOUBLE PRECISION,
    "customerTrackingNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'angemeldet',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetoureCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetoureEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "meta" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetoureEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RetoureCase_externalRef_key" ON "RetoureCase"("externalRef");
CREATE INDEX "RetoureCase_status_idx" ON "RetoureCase"("status");
CREATE INDEX "RetoureCase_bestellnummer_idx" ON "RetoureCase"("bestellnummer");
CREATE INDEX "RetoureCase_dhlTrackingNumber_idx" ON "RetoureCase"("dhlTrackingNumber");
CREATE INDEX "RetoureCase_createdAt_idx" ON "RetoureCase"("createdAt");

CREATE INDEX "RetoureEvent_caseId_idx" ON "RetoureEvent"("caseId");
CREATE INDEX "RetoureEvent_type_idx" ON "RetoureEvent"("type");
CREATE INDEX "RetoureEvent_createdAt_idx" ON "RetoureEvent"("createdAt");

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "RetoureEvent" ADD CONSTRAINT "RetoureEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RetoureCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
