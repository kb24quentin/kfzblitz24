-- Phase 7 — Lieferanten-Stammdaten + Lieferanten-Retouren
--
-- KEIN FK auf "Container" in dieser Migration: die Container-Tabelle
-- wird in einer parallelen Migration (20260518_03_container) erzeugt
-- und steht zum Zeitpunkt dieser Migration evtl. noch nicht. Wir
-- referenzieren die Container-Id daher als losen String und überlassen
-- die Auflösung der Anwendungs-Schicht.

CREATE TABLE "Supplier" (
    "id"              TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "contactPerson"   TEXT,
    "email"           TEXT,
    "phone"           TEXT,
    "street"          TEXT,
    "postalCode"      TEXT,
    "city"            TEXT,
    "country"         TEXT NOT NULL DEFAULT 'DE',
    "rmaPolicy"       TEXT,
    "defaultLeadDays" INTEGER NOT NULL DEFAULT 30,
    "active"          BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Supplier_name_key"   ON "Supplier"("name");
CREATE INDEX        "Supplier_active_idx" ON "Supplier"("active");
CREATE INDEX        "Supplier_name_idx"   ON "Supplier"("name");

CREATE TABLE "SupplierReturn" (
    "id"             TEXT NOT NULL,
    "supplierId"     TEXT NOT NULL,
    "containerId"    TEXT,
    "trackingNumber" TEXT,
    "status"         TEXT NOT NULL DEFAULT 'vorbereitet',
    "shippedAt"      TIMESTAMP(3),
    "receivedAt"     TIMESTAMP(3),
    "refundedAt"     TIMESTAMP(3),
    "refundAmount"   DOUBLE PRECISION,
    "notes"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierReturn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierReturn_status_idx"      ON "SupplierReturn"("status");
CREATE INDEX "SupplierReturn_supplierId_idx"  ON "SupplierReturn"("supplierId");
CREATE INDEX "SupplierReturn_containerId_idx" ON "SupplierReturn"("containerId");

ALTER TABLE "SupplierReturn"
  ADD CONSTRAINT "SupplierReturn_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
