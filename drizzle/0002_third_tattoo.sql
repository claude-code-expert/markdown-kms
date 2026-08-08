CREATE TABLE "folder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"is_trash_root" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folder_closure" (
	"ancestor_id" uuid NOT NULL,
	"descendant_id" uuid NOT NULL,
	"depth" integer NOT NULL,
	CONSTRAINT "folder_closure_ancestor_id_descendant_id_pk" PRIMARY KEY("ancestor_id","descendant_id")
);
--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_parent_id_folder_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folder"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_closure" ADD CONSTRAINT "folder_closure_ancestor_id_folder_id_fk" FOREIGN KEY ("ancestor_id") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_closure" ADD CONSTRAINT "folder_closure_descendant_id_folder_id_fk" FOREIGN KEY ("descendant_id") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "folder_active_idx" ON "folder" USING btree ("workspace_id","parent_id") WHERE "folder"."is_deleted" = false;--> statement-breakpoint
CREATE INDEX "folder_closure_descendant_idx" ON "folder_closure" USING btree ("descendant_id");