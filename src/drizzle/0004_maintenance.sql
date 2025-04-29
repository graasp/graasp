CREATE TABLE "maintenance" (
	"slug" varchar(100) NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	CONSTRAINT "maintenance_slug_key" UNIQUE("slug")
);
