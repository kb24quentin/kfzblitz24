-- Order + OrderSignatureRequest — verbindliche vereinbarung zwischen
-- werkstatt und kunde mit signatur-workflow (vor-ort ODER remote per link).

ALTER TABLE "Workshop" ADD COLUMN "orderPrefix"     TEXT NOT NULL DEFAULT 'AU-';
ALTER TABLE "Workshop" ADD COLUMN "orderNumberYear" INT;
ALTER TABLE "Workshop" ADD COLUMN "orderNumberLast" INT NOT NULL DEFAULT 0;

CREATE TABLE "Order" (
    "id"                              TEXT NOT NULL,
    "workshopId"                      TEXT NOT NULL,
    "orderNumber"                     TEXT NOT NULL,
    "customerId"                      TEXT NOT NULL,
    "vehicleId"                       TEXT,
    "basedOnQuoteId"                  TEXT,
    "positions"                       JSONB NOT NULL,
    "subtotalNetCent"                 INT NOT NULL DEFAULT 0,
    "totalVatCent"                    INT NOT NULL DEFAULT 0,
    "totalGrossCent"                  INT NOT NULL DEFAULT 0,
    "approvedAmountCent"              INT,
    "approvalFreetext"                TEXT,
    "status"                          TEXT NOT NULL DEFAULT 'draft',
    "signedAt"                        TIMESTAMP(3),
    "signatureSvg"                    TEXT,
    "signedByName"                    TEXT,
    "notes"                           TEXT,
    "createdBy"                       TEXT,
    "convertedToInvoiceId"            TEXT,
    "currentSignatureTokenExpiresAt"  TIMESTAMP(3),
    "createdAt"                       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
ALTER TABLE "Order" ADD CONSTRAINT "Order_workshopId_fkey"           FOREIGN KEY ("workshopId")           REFERENCES "Workshop"("id")     ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey"           FOREIGN KEY ("customerId")           REFERENCES "Customer"("id")     ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_vehicleId_fkey"            FOREIGN KEY ("vehicleId")            REFERENCES "Vehicle"("id")      ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_basedOnQuoteId_fkey"       FOREIGN KEY ("basedOnQuoteId")       REFERENCES "Quote"("id")        ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdBy_fkey"            FOREIGN KEY ("createdBy")            REFERENCES "WorkshopUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_convertedToInvoiceId_fkey" FOREIGN KEY ("convertedToInvoiceId") REFERENCES "Invoice"("id")      ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Order_workshopId_createdAt_idx" ON "Order"("workshopId","createdAt");
CREATE INDEX "Order_workshopId_status_idx"    ON "Order"("workshopId","status");

CREATE TABLE "OrderSignatureRequest" (
    "id"                 TEXT NOT NULL,
    "orderId"            TEXT NOT NULL,
    "requestedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedBy"        TEXT,
    "sentVia"            TEXT NOT NULL,
    "sentTo"             TEXT,
    "approvedAmountCent" INT,
    "approvalFreetext"   TEXT,
    "positionsSnapshot"  JSONB,
    "totalGrossCent"     INT,
    "status"             TEXT NOT NULL DEFAULT 'pending',
    "respondedAt"        TIMESTAMP(3),
    "signatureSvg"       TEXT,
    "signedByName"       TEXT,
    "signatureIp"        TEXT,
    "rejectionReason"    TEXT,
    "token"              TEXT NOT NULL,
    "tokenExpiresAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderSignatureRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderSignatureRequest_token_key" ON "OrderSignatureRequest"("token");
ALTER TABLE "OrderSignatureRequest" ADD CONSTRAINT "OrderSignatureRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "OrderSignatureRequest_orderId_requestedAt_idx" ON "OrderSignatureRequest"("orderId","requestedAt");

-- Appointment.orderId als FK
ALTER TABLE "Appointment" ADD COLUMN "orderId" TEXT;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Appointment_orderId_idx" ON "Appointment"("orderId");
