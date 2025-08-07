DROP TABLE "page" CASCADE;--> statement-breakpoint
CREATE TABLE "page_update" (
	"item_id" uuid NOT NULL,
	"update" "bytea" NOT NULL,
	"clock" integer NOT NULL
);--> statement-breakpoint
ALTER TABLE "page_update" ADD CONSTRAINT "FK_page_update_item_id" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_page_item_id" ON "page_update" USING btree ("item_id" uuid_ops);