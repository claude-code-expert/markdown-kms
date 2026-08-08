CREATE TABLE "document_tag" (
	"document_id" uuid NOT NULL,
	"tag" text NOT NULL,
	CONSTRAINT "document_tag_document_id_tag_pk" PRIMARY KEY("document_id","tag")
);
--> statement-breakpoint
ALTER TABLE "document_tag" ADD CONSTRAINT "document_tag_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;