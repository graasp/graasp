
ALTER TABLE "publisher" RENAME TO "publishers";--> statement-breakpoint


ALTER TABLE "app" RENAME TO "apps";--> statement-breakpoint
ALTER TABLE "apps" DROP CONSTRAINT "FK_37eb7baab82e11150157ec0b5a6";--> statement-breakpoint
ALTER TABLE "apps" ADD CONSTRAINT "apps_publisher_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Add the new thumbnail column
ALTER TABLE "apps" ADD COLUMN "thumbnail" varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
-- Copy the image property from the extra (jsonb) column to the new thumbnail column
UPDATE "apps"
SET "thumbnail" = "extra"->>'image'
WHERE "extra" ? 'image';
--> statement-breakpoint
ALTER TABLE "apps" DROP COLUMN "extra";
--> statement-breakpoint


ALTER TABLE "item_published" RENAME TO "published_items";--> statement-breakpoint
ALTER TABLE "published_items" DROP CONSTRAINT "item_published_creator_id_account_id_fk";
--> statement-breakpoint
ALTER TABLE "published_items" DROP CONSTRAINT "item_published_item_path_item_path_fk";
--> statement-breakpoint
ALTER TABLE "published_items" ADD CONSTRAINT "published_items_creator_id_account_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_items" ADD CONSTRAINT "published_items_item_path_item_path_fk" FOREIGN KEY ("item_path") REFERENCES "public"."item"("path") ON DELETE cascade ON UPDATE cascade;

INSERT INTO "schema_migrations" ("version", "inserted_at") VALUES
('20250828053810', '2025-08-28 10:28:02'), -- item and published_items update
('20250901102230', '2025-08-28 10:28:02'), -- add app key
('20250902085812', '2025-08-28 10:28:02'), -- rename users to admins
('20250904060051', '2025-08-28 10:28:02'), -- rename removal_notices to publication_removal_notices
('20250904072624', '2025-08-28 10:28:02'); -- add account table
