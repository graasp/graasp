CREATE TYPE "public"."item_request_export_type_enum" AS ENUM('raw', 'graasp');--> statement-breakpoint
CREATE TABLE "item_request_export" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"member_id" uuid,
	"item_id" uuid,
	"type" "item_request_export_type_enum" NOT NULL
);
--> statement-breakpoint 
ALTER TABLE "item_request_export" ADD CONSTRAINT "FK_item_request_export_item_id" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "item_request_export" ADD CONSTRAINT "FK_item_request_export_member_id" FOREIGN KEY ("member_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint 