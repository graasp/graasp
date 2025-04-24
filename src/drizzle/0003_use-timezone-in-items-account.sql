-- Need to drop the views before changing the column types 
DROP view item_view;--> statement-breakpoint
DROP view guests_view;--> statement-breakpoint
DROP view members_view;--> statement-breakpoint

-- Alter column types to use timestamp with timezone
ALTER TABLE membership_request ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE item ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE item ALTER COLUMN "updated_at" type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE item ALTER COLUMN "deleted_at" type timestamptz USING deleted_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE account ALTER COLUMN created_at type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE account ALTER COLUMN "updated_at" type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE account ALTER COLUMN user_agreements_date type timestamptz USING user_agreements_date AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE account ALTER COLUMN last_authenticated_at type timestamptz USING last_authenticated_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "action_request_export" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "action" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "app_action" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "app_data" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "app_data" ALTER COLUMN "updated_at" type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "app_setting" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "app_setting" ALTER COLUMN "updated_at" type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "app" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "app" ALTER COLUMN "updated_at" type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "chat_mention" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "chat_mention" ALTER COLUMN "updated_at" type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "chat_message" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "chat_message" ALTER COLUMN "updated_at" type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "guest_password" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "guest_password" ALTER COLUMN "updated_at" type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "invitation" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "invitation" ALTER COLUMN "updated_at" type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "item_favorite" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "item_category" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "item_flag" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "item_geolocation" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "item_geolocation" ALTER COLUMN "updated_at" type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "item_like" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "item_login_schema" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "item_login_schema" ALTER COLUMN "updated_at" type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "item_membership" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "item_membership" ALTER COLUMN "updated_at" type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "item_validation_group" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "item_validation_review" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "item_validation_review" ALTER COLUMN "updated_at" type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "item_validation" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "item_validation" ALTER COLUMN "updated_at" type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "item_visibility" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "member_password" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "member_password" ALTER COLUMN "updated_at" type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "member_profile" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "member_profile" ALTER COLUMN "updated_at" type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "item_published" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "item_published" ALTER COLUMN "updated_at" type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "publisher" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "publisher" ALTER COLUMN "updated_at" type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "recycled_item_data" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "short_link" ALTER COLUMN "created_at" type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint


-- Re-create the views after the column type change
CREATE VIEW "public"."item_view" AS (select "id", "name", "type", "description", "path", "creator_id", "extra", "settings", "created_at", "updated_at", "lang", "order" from "item" where "item"."deleted_at" is null);--> statement-breakpoint
CREATE VIEW "public"."guests_view" AS (select "id", "name", "extra", "type", "created_at", "updated_at", "last_authenticated_at", "is_validated", "item_login_schema_id" from "account" where ("account"."type" = 'guest' and "account"."item_login_schema_id" is not null));--> statement-breakpoint
CREATE VIEW "public"."members_view" AS (select "id", "name", "email", "extra", "type", "created_at", "updated_at", "user_agreements_date", "enable_save_actions", "last_authenticated_at", "is_validated" from "account" where ("account"."type" = 'individual' and "account"."email" is not null));--> statement-breakpoint

