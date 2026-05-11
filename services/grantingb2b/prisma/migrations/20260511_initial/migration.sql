-- CreateTable
CREATE TABLE "B2BCase" (
    "id" TEXT NOT NULL,
    "customerType" TEXT NOT NULL,
    "businessSubtype" TEXT,
    "companyName" TEXT NOT NULL,
    "contactFirstName" TEXT NOT NULL,
    "contactLastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "street" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Deutschland',
    "shippingSameAsBilling" BOOLEAN NOT NULL DEFAULT true,
    "shippingStreet" TEXT,
    "shippingPostalCode" TEXT,
    "shippingCity" TEXT,
    "shippingCountry" TEXT,
    "ustId" TEXT,
    "gewerbescheinPath" TEXT,
    "gewerbescheinFilename" TEXT,
    "gewerbescheinMimeType" TEXT,
    "gewerbescheinSizeBytes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "score" INTEGER,
    "assessmentJson" TEXT,
    "recommendation" TEXT,
    "decision" TEXT,
    "decisionReason" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'form',
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "B2BCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "B2BCaseEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "detailsJson" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "B2BCaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "B2BCase_status_idx" ON "B2BCase"("status");

-- CreateIndex
CREATE INDEX "B2BCase_email_idx" ON "B2BCase"("email");

-- CreateIndex
CREATE INDEX "B2BCase_companyName_idx" ON "B2BCase"("companyName");

-- CreateIndex
CREATE INDEX "B2BCaseEvent_caseId_idx" ON "B2BCaseEvent"("caseId");

-- CreateIndex
CREATE INDEX "B2BCaseEvent_createdAt_idx" ON "B2BCaseEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "B2BCaseEvent" ADD CONSTRAINT "B2BCaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "B2BCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
