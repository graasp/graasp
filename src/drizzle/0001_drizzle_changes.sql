ALTER TABLE IF EXISTS "role" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "role" CASCADE;--> statement-breakpoint

ALTER TABLE "migrations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "migrations" CASCADE;--> statement-breakpoint

ALTER TABLE "typeorm_metadata" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "typeorm_metadata" CASCADE;--> statement-breakpoint

ALTER TABLE "member_profile" RENAME COLUMN "facebookID" TO "facebookId";--> statement-breakpoint
ALTER TABLE "member_profile" RENAME COLUMN "linkedinID" TO "linkedinId";--> statement-breakpoint
ALTER TABLE "member_profile" RENAME COLUMN "twitterID" TO "twitterId";--> statement-breakpoint

ALTER TABLE "short_link" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint

ALTER TABLE "account" DROP CONSTRAINT "FK_account_item_login_schema_id";
--> statement-breakpoint
ALTER TABLE "item_login_schema" DROP CONSTRAINT "FK_b4a263d8c8392a73e0a1febf7d3";
--> statement-breakpoint
ALTER TABLE "item_published" DROP CONSTRAINT "FK_490fddd9099ee7ddcccf8c776a1";
--> statement-breakpoint
ALTER TABLE "item_published" DROP CONSTRAINT "FK_bfeeeb8d1257029e4d7f7ec1375";
--> statement-breakpoint
ALTER TABLE "item_membership" DROP CONSTRAINT "FK_25b6506de99e92886ed97174ab8";
--> statement-breakpoint
ALTER TABLE "item_membership" DROP CONSTRAINT "FK_d935785e7ecc015ed3ca048ff05";
--> statement-breakpoint
ALTER TABLE "item_membership" DROP CONSTRAINT "FK_item_membership_account_id";
--> statement-breakpoint
ALTER TABLE "member_password" DROP CONSTRAINT "FK_member_password_member_id";
--> statement-breakpoint

ALTER TABLE "account" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint

ALTER TABLE "account" ADD COLUMN "extra_new" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
UPDATE "account" SET "extra_new" = "extra"::jsonb; --> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "extra"--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "extra_new" TO "extra";--> statement-breakpoint

CREATE TYPE "public"."account_type_enum" AS ENUM('individual', 'guest');--> statement-breakpoint

DROP INDEX "IDX_account_type";--> statement-breakpoint

ALTER TABLE "account" ADD COLUMN "type_new" account_type_enum NOT NULL DEFAULT 'individual'::account_type_enum;--> statement-breakpoint
UPDATE "account" SET "type_new" = "type"::account_type_enum; --> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "type"--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "type_new" TO "type";--> statement-breakpoint

CREATE INDEX "IDX_account_type" ON "account" USING btree ("type" enum_ops);--> statement-breakpoint

-- Check if we need to run these ? The dump seems to not have them, but do we need them, if they are created on the database
ALTER TABLE "account" ADD CONSTRAINT "CHK_account_is_validated" CHECK ((is_validated IS NOT NULL) OR ((type)::text <> 'individual'::text));--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "CHK_account_email" CHECK ((email IS NOT NULL) OR ((type)::text <> 'individual'::text));--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "CHK_account_extra" CHECK ((extra IS NOT NULL) OR ((type)::text <> 'individual'::text));--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "CHK_account_enable_save_actions" CHECK ((enable_save_actions IS NOT NULL) OR ((type)::text <> 'individual'::text));--> statement-breakpoint


ALTER TABLE "chat_mention" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "chat_mention" ALTER COLUMN "message_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_mention" ALTER COLUMN "account_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "item_category" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "action_request_export" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint

ALTER TABLE "app" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "app" ALTER COLUMN "key" SET DEFAULT gen_random_uuid();--> statement-breakpoint

ALTER TABLE "app" ADD COLUMN "extra_new" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
UPDATE "app" SET "extra_new" = "extra"::jsonb; --> statement-breakpoint
ALTER TABLE "app" DROP COLUMN "extra"--> statement-breakpoint
ALTER TABLE "app" RENAME COLUMN "extra_new" TO "extra";--> statement-breakpoint

ALTER TABLE "category" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "chat_message" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "chat_message" ALTER COLUMN "item_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "invitation" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint

CREATE TYPE "public"."permission_enum" AS ENUM('read', 'write', 'admin');--> statement-breakpoint
ALTER TABLE "invitation" ADD COLUMN "permission_new" permission_enum NOT NULL DEFAULT 'read'::permission_enum;--> statement-breakpoint
UPDATE "invitation" SET "permission_new" = "permission"::permission_enum; --> statement-breakpoint
ALTER TABLE "invitation" DROP COLUMN "permission"--> statement-breakpoint
ALTER TABLE "invitation" RENAME COLUMN "permission_new" TO "permission";--> statement-breakpoint


ALTER TABLE "app_data" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint

-- create a new column for the data of appdata

ALTER TABLE "app_data" ADD COLUMN "data_new" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
UPDATE "app_data" SET "data_new" = "data"::jsonb; --> statement-breakpoint
ALTER TABLE "app_data" DROP COLUMN "data"--> statement-breakpoint
ALTER TABLE "app_data" RENAME COLUMN "data_new" TO "data";--> statement-breakpoint


ALTER TABLE "app_action" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint

-- create a new column for the data of appaction

ALTER TABLE "app_action" ADD COLUMN "data_new" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
UPDATE "app_action" SET "data_new" = "data"::jsonb; --> statement-breakpoint
ALTER TABLE "app_action" DROP COLUMN "data"--> statement-breakpoint
ALTER TABLE "app_action" RENAME COLUMN "data_new" TO "data";--> statement-breakpoint


ALTER TABLE "app_setting" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint

-- Update data column type to jsonb

ALTER TABLE "app_setting" ADD COLUMN "data_new" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
UPDATE "app_setting" SET "data_new" = "data"::jsonb; --> statement-breakpoint
ALTER TABLE "app_setting" DROP COLUMN "data"--> statement-breakpoint
ALTER TABLE "app_setting" RENAME COLUMN "data_new" TO "data";--> statement-breakpoint

-- delete actions that are not needed anymore (get and get_children)
DELETE FROM "action" WHERE "type" = 'get' OR "type" = 'get_children';

ALTER TABLE "action" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint

-- convert action.extra column to jsonb and set the default to an empty object
ALTER TABLE "action" ADD COLUMN "extra_new" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
UPDATE "action" SET "extra_new" = "extra"::jsonb; --> statement-breakpoint
ALTER TABLE "action" DROP COLUMN "extra"--> statement-breakpoint
ALTER TABLE "action" RENAME COLUMN "extra_new" TO "extra";--> statement-breakpoint

-- convert geolocation column to a jsonb column (it is still nullable)
ALTER TABLE "action" ADD COLUMN "geolocation_new" jsonb;--> statement-breakpoint
UPDATE "action" SET "geolocation_new" = "geolocation"::jsonb WHERE "geolocation" IS NOT NULL; --> statement-breakpoint
ALTER TABLE "action" DROP COLUMN "geolocation"--> statement-breakpoint
ALTER TABLE "action" RENAME COLUMN "geolocation_new" TO "geolocation";--> statement-breakpoint

-- convert view column
CREATE TYPE "public"."action_view_enum" AS ENUM('builder', 'player', 'library', 'explorer', 'account', 'auth', 'unknown');--> statement-breakpoint
ALTER TABLE "action" ADD COLUMN "view_new" action_view_enum DEFAULT 'unknown'::action_view_enum;--> statement-breakpoint
UPDATE "action" SET "view_new" = "view"::action_view_enum WHERE "view" IS NOT NULL; --> statement-breakpoint
ALTER TABLE "action" DROP COLUMN "view"--> statement-breakpoint
ALTER TABLE "action" RENAME COLUMN "view_new" TO "view";--> statement-breakpoint
ALTER TABLE "action" ALTER COLUMN "view" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "guest_password" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint

-- Update extra column type to jsonb
DROP INDEX "IDX_gin_item_search_document";--> statement-breakpoint
ALTER TABLE "item" DROP COLUMN "search_document";--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "extra_new" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
UPDATE "item" SET "extra_new" = "extra"::jsonb; --> statement-breakpoint
ALTER TABLE "item" DROP COLUMN "extra"--> statement-breakpoint
ALTER TABLE "item" RENAME COLUMN "extra_new" TO "extra";--> statement-breakpoint

-- Update settings column type to jsonb

ALTER TABLE "item" ADD COLUMN "settings_new" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
UPDATE "item" SET "settings_new" = "settings"::jsonb; --> statement-breakpoint
ALTER TABLE "item" DROP COLUMN "settings"--> statement-breakpoint
ALTER TABLE "item" RENAME COLUMN "settings_new" TO "settings";--> statement-breakpoint


CREATE TYPE "public"."item_login_schema_type" AS ENUM('username', 'username+password', 'anonymous', 'anonymous+password');--> statement-breakpoint
CREATE TYPE "public"."item_login_schema_status" AS ENUM('active', 'freeze', 'disabled');--> statement-breakpoint

ALTER TABLE "item_login_schema" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "item_login_schema" ALTER COLUMN "type" SET DATA TYPE item_login_schema_type USING type::item_login_schema_type;--> statement-breakpoint
ALTER TABLE "item_login_schema" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "item_login_schema" ALTER COLUMN "status" SET DATA TYPE item_login_schema_status USING status::item_login_schema_status;--> statement-breakpoint
ALTER TABLE "item_login_schema" ALTER COLUMN "status" SET DEFAULT 'active'::item_login_schema_status;--> statement-breakpoint

ALTER TABLE "item_flag" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint

ALTER TABLE "item_published" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "item_geolocation" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "item_membership" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "item_membership" ALTER COLUMN "permission" SET DATA TYPE permission_enum USING permission::permission_enum;--> statement-breakpoint

ALTER TABLE "item_validation" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
CREATE TYPE "public"."item_validation_process" AS ENUM('bad-words-detection', 'image-classification');--> statement-breakpoint
ALTER TABLE "item_validation" ALTER COLUMN "process" SET DATA TYPE item_validation_process USING process::item_validation_process;--> statement-breakpoint

CREATE TYPE "public"."item_validation_status" AS ENUM('success', 'failure', 'pending', 'pending-manual');--> statement-breakpoint
ALTER TABLE "item_validation" ALTER COLUMN "status" SET DATA TYPE item_validation_status USING status::item_validation_status;--> statement-breakpoint

ALTER TABLE "item_validation_review" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "item_validation_group" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "item_visibility" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint

CREATE TYPE "public"."item_visibility_type" AS ENUM('public', 'hidden');--> statement-breakpoint
ALTER TABLE "item_visibility" ALTER COLUMN "type" SET DATA TYPE item_visibility_type USING type::item_visibility_type;--> statement-breakpoint

ALTER TABLE "recycled_item_data" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "member_profile" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "member_profile" ALTER COLUMN "member_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "member_profile" DROP COLUMN "deleted_at";--> statement-breakpoint

ALTER TABLE "publisher" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "member_password" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "membership_request" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "item_favorite" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "item_like" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "tag" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint

ALTER TABLE "account" ADD CONSTRAINT "account_item_login_schema_id_item_login_schema_id_fk" FOREIGN KEY ("item_login_schema_id") REFERENCES "public"."item_login_schema"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_mention" ADD CONSTRAINT "chat_mention_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_mention" ADD CONSTRAINT "chat_mention_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_creator_id_account_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_item_path_item_path_fk" FOREIGN KEY ("item_path") REFERENCES "public"."item"("path") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_login_schema" ADD CONSTRAINT "item_login_schema_item_path_item_path_fk" FOREIGN KEY ("item_path") REFERENCES "public"."item"("path") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "item_published" ADD CONSTRAINT "item_published_creator_id_account_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_published" ADD CONSTRAINT "item_published_item_path_item_path_fk" FOREIGN KEY ("item_path") REFERENCES "public"."item"("path") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "item_membership" ADD CONSTRAINT "item_membership_item_path_item_path_fk" FOREIGN KEY ("item_path") REFERENCES "public"."item"("path") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "item_membership" ADD CONSTRAINT "item_membership_creator_id_account_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_membership" ADD CONSTRAINT "item_membership_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_profile" ADD CONSTRAINT "member_profile_member_id_account_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_password" ADD CONSTRAINT "member_password_member_id_account_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE VIEW "public"."guests_view" AS (select "id", "name", "extra", "type", "created_at", "updated_at", "last_authenticated_at", "is_validated", "item_login_schema_id" from "account" where ("account"."type" = 'guest' and "account"."item_login_schema_id" is not null));--> statement-breakpoint
CREATE VIEW "public"."item_view" AS (select "id", "name", "type", "description", "path", "creator_id", "extra", "settings", "created_at", "updated_at", "lang", "order" from "item" where "item"."deleted_at" is null);--> statement-breakpoint
CREATE VIEW "public"."members_view" AS (select "id", "name", "email", "extra", "type", "created_at", "updated_at", "user_agreements_date", "enable_save_actions", "last_authenticated_at", "is_validated" from "account" where ("account"."type" = 'individual' and "account"."email" is not null));--> statement-breakpoint
