-- Make Email.campaignId and Email.templateId nullable so we can record
-- one-off, manually-sent emails (from the contact detail page) that
-- aren't part of any campaign or template.
ALTER TABLE "Email" ALTER COLUMN "campaignId" DROP NOT NULL;
ALTER TABLE "Email" ALTER COLUMN "templateId" DROP NOT NULL;
