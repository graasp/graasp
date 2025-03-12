CREATE TYPE "public"."item_visibility_type" AS ENUM('public', 'hidden');
--> statement-breakpoint
ALTER TABLE "member_profile"
  RENAME COLUMN "facebookID" TO "facebookId";
--> statement-breakpoint
ALTER TABLE "member_profile"
  RENAME COLUMN "linkedinID" TO "linkedinId";
--> statement-breakpoint
ALTER TABLE "member_profile"
  RENAME COLUMN "twitterID" TO "twitterId";
--> statement-breakpoint
ALTER TABLE "item_published" DROP CONSTRAINT "FK_bfeeeb8d1257029e4d7f7ec1375";
--> statement-breakpoint
ALTER TABLE "item_published" DROP CONSTRAINT "FK_490fddd9099ee7ddcccf8c776a1";
--> statement-breakpoint
ALTER TABLE "item_membership" DROP CONSTRAINT "FK_25b6506de99e92886ed97174ab8";
--> statement-breakpoint
ALTER TABLE "item_membership" DROP CONSTRAINT "FK_d935785e7ecc015ed3ca048ff05";
--> statement-breakpoint
ALTER TABLE "item_membership" DROP CONSTRAINT "FK_item_membership_account_id";
--> statement-breakpoint
ALTER TABLE "member_password" DROP CONSTRAINT "FK_member_password_member_id";
--> statement-breakpoint
ALTER TABLE "account" DROP CONSTRAINT "FK_account_item_login_schema_id";
--> statement-breakpoint
ALTER TABLE "item_login_schema" DROP CONSTRAINT "FK_b4a263d8c8392a73e0a1febf7d3";
--> statement-breakpoint
-- DROP INDEX "IDX_gin_item_search_document";
--> statement-breakpoint
--
--
ALTER TABLE "member_profile"
ALTER COLUMN "member_id"
SET NOT NULL;
--> statement-breakpoint
--
--
ALTER TABLE "account"
alter column extra drop default;
ALTER TABLE "account"
ALTER COLUMN "extra"
SET DATA TYPE jsonb USING extra::jsonb;
--> statement-breakpoint
ALTER TABLE "account"
ALTER COLUMN "extra"
SET DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "account"
ALTER COLUMN "extra"
SET NOT NULL;
--> statement-breakpoint
--
-- Item visibility
--
ALTER TABLE "item_visibility"
ALTER COLUMN "type"
SET DATA TYPE item_visibility_type USING item_visibility::text::item_visibility_type;
--> statement-breakpoint
ALTER TABLE "item_published"
ADD CONSTRAINT "item_published_creator_id_account_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."account"("id") ON DELETE
set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "item_published"
ADD CONSTRAINT "item_published_item_path_item_path_fk" FOREIGN KEY ("item_path") REFERENCES "public"."item"("path") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "item_membership"
ADD CONSTRAINT "item_membership_item_path_item_path_fk" FOREIGN KEY ("item_path") REFERENCES "public"."item"("path") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "item_membership"
ADD CONSTRAINT "item_membership_creator_id_account_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."account"("id") ON DELETE
set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "item_membership"
ADD CONSTRAINT "item_membership_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "member_password"
ADD CONSTRAINT "member_password_member_id_account_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invitation"
ADD CONSTRAINT "invitation_item_path_item_path_fk" FOREIGN KEY ("item_path") REFERENCES "public"."item"("path") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "member_profile"
ADD CONSTRAINT "member_profile_member_id_account_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "account"
ADD CONSTRAINT "account_item_login_schema_id_item_login_schema_id_fk" FOREIGN KEY ("item_login_schema_id") REFERENCES "public"."item_login_schema"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "item_login_schema"
ADD CONSTRAINT "item_login_schema_item_path_item_path_fk" FOREIGN KEY ("item_path") REFERENCES "public"."item"("path") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
-- ALTER TABLE "item" DROP COLUMN "search_document";
--> statement-breakpoint
CREATE VIEW "public"."item_view" AS (
  select "id",
    "name",
    "type",
    "description",
    "path",
    "creator_id",
    "extra",
    "settings",
    "created_at",
    "updated_at",
    "lang",
    "order"
  from "item"
  where "item"."deleted_at" is null
);
--> statement-breakpoint
CREATE VIEW "public"."members_view" AS (
  select "id",
    "name",
    "email",
    "extra",
    "type",
    "created_at",
    "updated_at",
    "user_agreements_date",
    "enable_save_actions",
    "last_authenticated_at",
    "is_validated"
  from "account"
  where (
      "account"."type" = 'individual'
      and "account"."email" is not null
    )
);

--> manually created!!
--> statement-breakpoint
CREATE VIEW "public"."guests_view" AS (
  select "id",
    "name", 
    "extra",
    "type",
    "created_at",
    "updated_at",
    "last_authenticated_at",
    "is_validated",
    "item_login_schema_id"
  from "account"
  where (
      "account"."type" = 'guest'
      and "account"."item_login_schema_id" is not null
    )
);
