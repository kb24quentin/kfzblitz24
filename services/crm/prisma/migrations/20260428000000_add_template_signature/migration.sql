-- Optional HTML signature appended to a template's body when emails are
-- rendered. Nullable so existing templates keep working unchanged.
ALTER TABLE "Template" ADD COLUMN "signature" TEXT;
