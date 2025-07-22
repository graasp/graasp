CREATE TABLE "admin" (
	"github_id" varchar(15) PRIMARY KEY NOT NULL,
	"github_name" varchar(39) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_authenticated_at" timestamp with time zone,
	CONSTRAINT "admin_github_id_unique" UNIQUE("github_id"),
	CONSTRAINT "admin_github_name_unique" UNIQUE("github_name")
);
