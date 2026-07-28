-- Password optional (null bis Setup abgeschlossen)
ALTER TABLE "WorkshopUser" ALTER COLUMN "password" DROP NOT NULL;

-- Setup-token für ersten Login
ALTER TABLE "WorkshopUser" ADD COLUMN "passwordSetupToken" TEXT;
ALTER TABLE "WorkshopUser" ADD COLUMN "passwordSetupExpires" TIMESTAMP(3);
CREATE UNIQUE INDEX "WorkshopUser_passwordSetupToken_key" ON "WorkshopUser"("passwordSetupToken");
