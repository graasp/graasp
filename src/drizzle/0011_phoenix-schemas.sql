CREATE EXTENSION IF NOT EXISTS citext;--> statement-breakpoint

CREATE TABLE "removal_notices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"publication_name" varchar(255),
	"reason" text,
	"user_id" uuid,
	"creator_id" uuid,
	"created_at" timestamp (0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schema_migrations" (
	"version" bigint PRIMARY KEY NOT NULL,
	"inserted_at" timestamp (0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" "citext" NOT NULL,
	"hashed_password" varchar(255),
	"confirmed_at" timestamp (0),
	"created_at" timestamp (0) NOT NULL,
	"updated_at" timestamp (0) NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "users_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token" "bytea" NOT NULL,
	"context" varchar(255) NOT NULL,
	"sent_to" varchar(255),
	"authenticated_at" timestamp (0),
	"created_at" timestamp (0) NOT NULL,
	CONSTRAINT "users_tokens_context_token_index" UNIQUE("context","token")
);
--> statement-breakpoint
ALTER TABLE "removal_notices" ADD CONSTRAINT "removal_notices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "removal_notices" ADD CONSTRAINT "removal_notices_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_tokens" ADD CONSTRAINT "users_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "removal_notices_user_id_index" ON "removal_notices" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "users_email_index" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_tokens_user_id_index" ON "users_tokens" USING btree ("user_id" uuid_ops);

INSERT INTO "schema_migrations" ("version", "inserted_at") VALUES
('20250806110912', '2025-08-27 10:28:02'), -- users and tokens table
('20250807113759', '2025-08-27 10:28:02'), -- published items table
('20250818111736', '2025-08-27 10:28:02'), -- removal notices table
('20250819070000', '2025-08-27 10:28:02'); -- apps and publishers table
