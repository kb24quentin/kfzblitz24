-- Message.kind (reply | acknowledgement | resend)
ALTER TABLE "Message" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'reply';

-- Message.resentFromId (self-reference for resend lineage)
ALTER TABLE "Message" ADD COLUMN "resentFromId" TEXT;
ALTER TABLE "Message"
    ADD CONSTRAINT "Message_resentFromId_fkey"
    FOREIGN KEY ("resentFromId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
