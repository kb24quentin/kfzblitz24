-- Google SSO: password becomes optional, add googleId + imageUrl
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN "imageUrl" TEXT;
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
