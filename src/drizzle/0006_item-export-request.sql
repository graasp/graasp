CREATE TYPE "public"."item_export_request_type_enum" AS ENUM('raw', 'graasp');--> statement-breakpoint
CREATE TABLE "item_export_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"member_id" uuid,
	"item_id" uuid,
	"type" "item_export_request_type_enum" NOT NULL
);
--> statement-breakpoint 
ALTER TABLE "item_export_request" ADD CONSTRAINT "item_export_request_member_id_account_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_export_request" ADD CONSTRAINT "item_export_request_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint