-- Custom SQL migration file, put your code below! --
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX "document_title_trgm_idx" ON "document" USING gin ("title" gin_trgm_ops) WHERE "document"."is_deleted" = false;
--> statement-breakpoint
CREATE INDEX "document_content_trgm_idx" ON "document" USING gin ("content" gin_trgm_ops) WHERE "document"."is_deleted" = false;
--> statement-breakpoint
UPDATE "document" SET "title" = normalize("title", NFC), "content" = normalize("content", NFC)
  WHERE "title" IS DISTINCT FROM normalize("title", NFC) OR "content" IS DISTINCT FROM normalize("content", NFC);
