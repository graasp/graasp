CREATE EXTENSION IF NOT EXISTS citext;--> statement-breakpoint

CREATE TABLE "publication_removal_notices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"publication_name" varchar(255),
	"reason" text,
	"item_id" uuid,
	"creator_id" uuid,
	"created_at" timestamp (0) NOT NULL
);
ALTER TABLE "publication_removal_notices" ADD CONSTRAINT "publication_removal_notices_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_removal_notices" ADD CONSTRAINT "publication_removal_notices_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "publication_removal_notices_user_id_index" ON "publication_removal_notices" USING btree ("user_id" uuid_ops);--> statement-breakpoint

--> statement-breakpoint
-- this is a table to hold the phoenix schema migrations
-- these migrations are currently handled by drizzle.
-- we insert the relevant data inside the table so phoenix is happy
CREATE TABLE "schema_migrations" (
	"version" bigint PRIMARY KEY NOT NULL,
	"inserted_at" timestamp (0)
);
INSERT INTO "schema_migrations" ("version", "inserted_at") VALUES
('20250806110912', '2025-08-27 10:28:02'), -- users and tokens table
('20250807113759', '2025-08-27 10:28:02'), -- published items table
('20250818111736', '2025-08-27 10:28:02'), -- removal notices table
('20250819070000', '2025-08-27 10:28:02'); -- apps and publishers table

--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" "citext" NOT NULL,
	"hashed_password" varchar(255),
	"confirmed_at" timestamp (0),
	"created_at" timestamp (0) NOT NULL,
	"updated_at" timestamp (0) NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "admins_email_index" ON "admins" USING btree ("email");--> statement-breakpoint

CREATE TABLE "admins_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token" "bytea" NOT NULL,
	"context" varchar(255) NOT NULL,
	"sent_to" varchar(255),
	"authenticated_at" timestamp (0),
	"created_at" timestamp (0) NOT NULL,
	CONSTRAINT "admins_tokens_context_token_index" UNIQUE("context","token")
);
--> statement-breakpoint
ALTER TABLE "admins_tokens" ADD CONSTRAINT "admins_tokens_user_id_admins_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admins_tokens_user_id_index" ON "admins_tokens" USING btree ("user_id" uuid_ops);
