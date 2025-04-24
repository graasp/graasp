-- Alter column types to use timestamp with timezone

Alter table membership_request alter column created_at type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint

-- Need to drop the view before changing the column types
DROP view item_view;--> statement-breakpoint
Alter table item alter column created_at type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
Alter table item alter column updated_at type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint
Alter table item alter column deleted_at type timestamptz USING deleted_at AT TIME ZONE 'UTC';--> statement-breakpoint
-- Re-create the item view after the column type change
CREATE VIEW "public"."item_view" AS (select "id", "name", "type", "description", "path", "creator_id", "extra", "settings", "created_at", "updated_at", "lang", "order" from "item" where "item"."deleted_at" is null);--> statement-breakpoint

-- Need to drop the guests and members view before changing the column types
Drop view guests_view;--> statement-breakpoint
Drop view members_view;--> statement-breakpoint
Alter table account alter column created_at type timestamptz USING created_at AT TIME ZONE 'UTC';--> statement-breakpoint
Alter table account alter column updated_at type timestamptz USING updated_at AT TIME ZONE 'UTC';--> statement-breakpoint
Alter table account alter column user_agreements_date type timestamptz USING user_agreements_date AT TIME ZONE 'UTC';--> statement-breakpoint
Alter table account alter column last_authenticated_at type timestamptz USING last_authenticated_at AT TIME ZONE 'UTC';--> statement-breakpoint
-- Re-create the guest and member views after the column type change
CREATE VIEW "public"."guests_view" AS (select "id", "name", "extra", "type", "created_at", "updated_at", "last_authenticated_at", "is_validated", "item_login_schema_id" from "account" where ("account"."type" = 'guest' and "account"."item_login_schema_id" is not null));--> statement-breakpoint
CREATE VIEW "public"."members_view" AS (select "id", "name", "email", "extra", "type", "created_at", "updated_at", "user_agreements_date", "enable_save_actions", "last_authenticated_at", "is_validated" from "account" where ("account"."type" = 'individual' and "account"."email" is not null));--> statement-breakpoint
