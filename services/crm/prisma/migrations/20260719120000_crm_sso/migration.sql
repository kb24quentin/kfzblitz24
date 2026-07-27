-- SSO-enable User: google-metadata + nullable password + updatedAt für Intranet-Sync.
ALTER TABLE "User"
  ADD COLUMN "googleId" TEXT,
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "password" DROP NOT NULL;

CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
