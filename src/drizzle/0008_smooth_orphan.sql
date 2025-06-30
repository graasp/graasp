ALTER TYPE "public"."action_view_enum" ADD VALUE 'analytics' BEFORE 'home';--> statement-breakpoint
CREATE TABLE "admins" (
	"userName" varchar PRIMARY KEY NOT NULL,
	"id" varchar,
	"last_authenticated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_userName_unique" UNIQUE("userName")
);
