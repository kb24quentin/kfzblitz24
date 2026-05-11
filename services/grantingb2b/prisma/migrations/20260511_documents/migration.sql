-- CreateTable
CREATE TABLE "B2BCaseDocument" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "note" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "B2BCaseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "B2BCaseDocument_caseId_idx" ON "B2BCaseDocument"("caseId");

-- CreateIndex
CREATE INDEX "B2BCaseDocument_kind_idx" ON "B2BCaseDocument"("kind");

-- AddForeignKey
ALTER TABLE "B2BCaseDocument" ADD CONSTRAINT "B2BCaseDocument_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "B2BCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
