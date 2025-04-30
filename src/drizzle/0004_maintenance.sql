CREATE TABLE "maintenance" (
	"slug" varchar(100) PRIMARY KEY NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	CONSTRAINT "UQ_maintenance_slug" UNIQUE("slug")
);
