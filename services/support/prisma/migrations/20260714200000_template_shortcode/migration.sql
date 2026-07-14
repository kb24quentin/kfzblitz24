-- Template.shortcode: typed as `::code` in composer for quick-insert
ALTER TABLE "Template" ADD COLUMN "shortcode" TEXT;
CREATE UNIQUE INDEX "Template_shortcode_key" ON "Template"("shortcode");
