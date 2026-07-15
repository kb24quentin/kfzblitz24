-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT,
    "aiDraftId" TEXT,
    "model" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'draft',
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "inputCostUsd" DOUBLE PRECISION NOT NULL,
    "outputCostUsd" DOUBLE PRECISION NOT NULL,
    "totalCostUsd" DOUBLE PRECISION NOT NULL,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_model_idx" ON "AiUsage"("model");

-- CreateIndex
CREATE INDEX "AiUsage_ticketId_idx" ON "AiUsage"("ticketId");

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
