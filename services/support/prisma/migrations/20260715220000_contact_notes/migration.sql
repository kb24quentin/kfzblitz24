-- Contact-level notes (nicht ticket-scoped) für kundenübergreifende infos.
CREATE TABLE "ContactNote" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactNote_contactId_idx" ON "ContactNote"("contactId");

ALTER TABLE "ContactNote"
    ADD CONSTRAINT "ContactNote_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactNote"
    ADD CONSTRAINT "ContactNote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
