CREATE TABLE "admins" (
	"user_name" varchar(39) PRIMARY KEY NOT NULL,
	"id" varchar(15),
	"last_authenticated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_user_name_unique" UNIQUE("user_name")
);
