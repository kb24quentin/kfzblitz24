-- WerkstattConnect initial schema. Multi-tenant SaaS für Kfz-Werkstätten.
CREATE TABLE "Workshop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "street" TEXT,
    "zip" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'DEU',
    "taxId" TEXT,
    "ownerEmail" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Workshop_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Workshop_slug_key" ON "Workshop"("slug");

CREATE TABLE "WorkshopUser" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'mitarbeiter',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkshopUser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkshopUser_email_key" ON "WorkshopUser"("email");
CREATE INDEX "WorkshopUser_workshopId_idx" ON "WorkshopUser"("workshopId");
ALTER TABLE "WorkshopUser" ADD CONSTRAINT "WorkshopUser_workshopId_fkey"
  FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "KbAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "googleId" TEXT,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KbAdmin_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KbAdmin_email_key" ON "KbAdmin"("email");
CREATE UNIQUE INDEX "KbAdmin_googleId_key" ON "KbAdmin"("googleId");

CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Customer_workshopId_idx" ON "Customer"("workshopId");
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_workshopId_fkey"
  FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
