-- ponytail: first generated migration, so it is a full baseline (folder/folder_permission
-- already exist in any db built with db:push). New in this migration: folder_request.
-- Baseline an existing database with `drizzle-kit migrate` only after marking 0000 applied.
CREATE TABLE "folder" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"label" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "folder_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "folder_permission" (
	"id" serial PRIMARY KEY NOT NULL,
	"folder_id" integer NOT NULL,
	"tailscale_login" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"access" text NOT NULL,
	CONSTRAINT "folder_permission_folder_id_tailscale_login_unique" UNIQUE("folder_id","tailscale_login")
);
--> statement-breakpoint
CREATE TABLE "folder_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"tailscale_login" text NOT NULL,
	"requested_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "folder_permission" ADD CONSTRAINT "folder_permission_folder_id_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "folder_request_one_pending_per_login" ON "folder_request" USING btree ("tailscale_login") WHERE "folder_request"."status" = 'pending';