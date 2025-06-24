ALTER TABLE "action" ALTER COLUMN "view" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "action" ALTER COLUMN "view" SET DEFAULT 'unknown'::text;--> statement-breakpoint
-- Migrate the view = explorer to the new library view
UPDATE "action" set view = 'library' WHERE view = 'explorer';--> statement-breakpoint
DROP TYPE "public"."action_view_enum";--> statement-breakpoint
CREATE TYPE "public"."action_view_enum" AS ENUM('builder', 'player', 'library', 'account', 'analytics', 'home', 'auth', 'unknown');--> statement-breakpoint
ALTER TABLE "action" ALTER COLUMN "view" SET DEFAULT 'unknown'::"public"."action_view_enum";--> statement-breakpoint
ALTER TABLE "action" ALTER COLUMN "view" SET DATA TYPE "public"."action_view_enum" USING "view"::"public"."action_view_enum";
