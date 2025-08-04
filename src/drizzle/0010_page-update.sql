ALTER TABLE "page" RENAME TO "page_update";--> statement-breakpoint
ALTER TABLE "page_update" DROP CONSTRAINT "FK_page_item_id";
--> statement-breakpoint
ALTER TABLE "page_update" ADD COLUMN "update" "bytea" NOT NULL;--> statement-breakpoint
ALTER TABLE "page_update" ADD COLUMN "clock" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "page_update" ADD CONSTRAINT "FK_page_update_item_id" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_update" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "page_update" DROP COLUMN "content";--> statement-breakpoint
ALTER TABLE "page_update" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "page_update" DROP COLUMN "updated_at";