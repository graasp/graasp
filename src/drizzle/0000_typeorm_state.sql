-- -- -- -- -- -- -- -- -- -- -- -- -- --
-- TYPEORM MIGRATION
-- If migrating from Typeorm, comment from here to the next comment
-- -- -- -- -- -- -- -- -- -- -- -- -- --

-- setup required extensions for the database
CREATE EXTENSION "ltree" with schema "public";--> statement-breakpoint
CREATE EXTENSION "uuid-ossp" with schema "public";--> statement-breakpoint
CREATE TYPE "public"."action_request_export_format_enum" AS ENUM('json', 'csv');--> statement-breakpoint
CREATE TYPE "public"."chat_mention_status_enum" AS ENUM('unread', 'read');--> statement-breakpoint
CREATE TYPE "public"."short_link_platform_enum" AS ENUM('builder', 'player', 'library');--> statement-breakpoint
CREATE TYPE "public"."tag_category_enum" AS ENUM('level', 'discipline', 'resource-type');--> statement-breakpoint
CREATE TABLE "app_data" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"account_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"data" text DEFAULT '{}' NOT NULL,
	"type" varchar(25) NOT NULL,
	"creator_id" uuid,
	"visibility" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(150),
	"extra" text DEFAULT '{}',
	"type" varchar DEFAULT 'individual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_agreements_date" timestamp,
	"enable_save_actions" boolean DEFAULT true,
	"last_authenticated_at" timestamp,
	"is_validated" boolean DEFAULT false,
	"item_login_schema_id" uuid,
	CONSTRAINT "UQ_account_name_item_login_schema_id" UNIQUE("name","item_login_schema_id"),
	CONSTRAINT "member_email_key1" UNIQUE("email"),
	CONSTRAINT "CHK_account_email" CHECK ((email IS NOT NULL) OR ((type)::text <> 'individual'::text)),
	CONSTRAINT "CHK_account_enable_save_actions" CHECK ((enable_save_actions IS NOT NULL) OR ((type)::text <> 'individual'::text)),
	CONSTRAINT "CHK_account_extra" CHECK ((extra IS NOT NULL) OR ((type)::text <> 'individual'::text)),
	CONSTRAINT "CHK_account_is_validated" CHECK ((is_validated IS NOT NULL) OR ((type)::text <> 'individual'::text))
);--> statement-breakpoint
CREATE TABLE "chat_mention" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"message_id" uuid,
	"account_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"status" "chat_mention_status_enum" DEFAULT 'unread' NOT NULL
);--> statement-breakpoint
CREATE TABLE "item_category" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"creator_id" uuid,
	"item_path" "ltree" NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "category-item" UNIQUE("item_path","category_id")
);--> statement-breakpoint
CREATE TABLE "action_request_export" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"member_id" uuid NOT NULL,
	"item_path" "ltree",
	"format" "action_request_export_format_enum" DEFAULT 'json' NOT NULL
);--> statement-breakpoint
CREATE TABLE "app" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"key" uuid DEFAULT uuid_generate_v4() NOT NULL,
	"name" varchar(250) NOT NULL,
	"description" varchar(250) NOT NULL,
	"url" varchar(250) NOT NULL,
	"publisher_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"extra" text DEFAULT '{}' NOT NULL,
	CONSTRAINT "app_key_key" UNIQUE("key"),
	CONSTRAINT "UQ_f36adbb7b096ceeb6f3e80ad14c" UNIQUE("name"),
	CONSTRAINT "app_url_key" UNIQUE("url")
);--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" varchar(50) NOT NULL,
	"type" varchar NOT NULL,
	CONSTRAINT "category-name-type" UNIQUE("name","type")
);--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"item_id" uuid,
	"creator_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"body" varchar(500) NOT NULL
);--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"creator_id" uuid,
	"item_path" "ltree" NOT NULL,
	"name" varchar(100),
	"email" varchar(100) NOT NULL,
	"permission" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "item-email" UNIQUE("item_path","email")
);--> statement-breakpoint
CREATE TABLE "app_action" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"account_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"data" text DEFAULT '{}' NOT NULL,
	"type" varchar(25) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "action" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"view" varchar NOT NULL,
	"type" varchar NOT NULL,
	"extra" text NOT NULL,
	"geolocation" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"account_id" uuid,
	"item_id" uuid
);--> statement-breakpoint
CREATE TABLE "guest_password" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"password" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"guest_id" uuid,
	CONSTRAINT "UQ_guest_password_guest_id" UNIQUE("guest_id")
);--> statement-breakpoint
CREATE TABLE "item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(500) NOT NULL,
	"type" varchar DEFAULT 'folder' NOT NULL,
	"description" varchar(5000),
	"path" "ltree" NOT NULL,
	"creator_id" uuid,
	"extra" text NOT NULL,
	"settings" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"lang" varchar DEFAULT 'en' NOT NULL,
	"search_document" "tsvector" GENERATED ALWAYS AS (((((((((((((((((((((((((((((((((((((setweight(to_tsvector('simple'::regconfig, (name)::text), 'A'::"char") || ''::tsvector) || setweight(to_tsvector('english'::regconfig, (name)::text), 'A'::"char")) || ''::tsvector) || setweight(to_tsvector('french'::regconfig, (name)::text), 'A'::"char")) || ''::tsvector) ||
CASE
    WHEN ((lang)::text = 'de'::text) THEN to_tsvector('german'::regconfig, (name)::text)
    WHEN ((lang)::text = 'it'::text) THEN to_tsvector('italian'::regconfig, (name)::text)
    WHEN ((lang)::text = 'es'::text) THEN to_tsvector('spanish'::regconfig, (name)::text)
    ELSE ''::tsvector
END) || ''::tsvector) || setweight(to_tsvector('english'::regconfig, (COALESCE(description, ''::character varying))::text), 'B'::"char")) || ''::tsvector) || setweight(to_tsvector('french'::regconfig, (COALESCE(description, ''::character varying))::text), 'B'::"char")) || ''::tsvector) ||
CASE
    WHEN ((lang)::text = 'de'::text) THEN setweight(to_tsvector('german'::regconfig, (COALESCE(description, ''::character varying))::text), 'B'::"char")
    WHEN ((lang)::text = 'it'::text) THEN setweight(to_tsvector('italian'::regconfig, (COALESCE(description, ''::character varying))::text), 'B'::"char")
    WHEN ((lang)::text = 'es'::text) THEN setweight(to_tsvector('spanish'::regconfig, (COALESCE(description, ''::character varying))::text), 'B'::"char")
    ELSE ''::tsvector
END) || ''::tsvector) || setweight(to_tsvector('english'::regconfig, COALESCE(((settings)::jsonb -> 'tags'::text), '{}'::jsonb)), 'C'::"char")) || ''::tsvector) || setweight(to_tsvector('french'::regconfig, COALESCE(((settings)::jsonb -> 'tags'::text), '{}'::jsonb)), 'C'::"char")) || ''::tsvector) ||
CASE
    WHEN ((lang)::text = 'de'::text) THEN setweight(to_tsvector('german'::regconfig, COALESCE(((settings)::jsonb -> 'tags'::text), '{}'::jsonb)), 'C'::"char")
    WHEN ((lang)::text = 'it'::text) THEN setweight(to_tsvector('italian'::regconfig, COALESCE(((settings)::jsonb -> 'tags'::text), '{}'::jsonb)), 'C'::"char")
    WHEN ((lang)::text = 'es'::text) THEN setweight(to_tsvector('spanish'::regconfig, COALESCE(((settings)::jsonb -> 'tags'::text), '{}'::jsonb)), 'C'::"char")
    ELSE ''::tsvector
END) || ''::tsvector) || setweight(to_tsvector('english'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'document'::text) ->> 'content'::text), '{}'::text)), 'D'::"char")) || ''::tsvector) || setweight(to_tsvector('french'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'document'::text) ->> 'content'::text), '{}'::text)), 'D'::"char")) || ''::tsvector) ||
CASE
    WHEN ((lang)::text = 'de'::text) THEN setweight(to_tsvector('german'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'document'::text) ->> 'content'::text), '{}'::text)), 'D'::"char")
    WHEN ((lang)::text = 'it'::text) THEN setweight(to_tsvector('italian'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'document'::text) ->> 'content'::text), '{}'::text)), 'D'::"char")
    WHEN ((lang)::text = 'es'::text) THEN setweight(to_tsvector('spanish'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'document'::text) ->> 'content'::text), '{}'::text)), 'D'::"char")
    ELSE ''::tsvector
END) || ''::tsvector) || setweight(to_tsvector('english'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'file'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")) || ''::tsvector) || setweight(to_tsvector('french'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'file'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")) || ''::tsvector) ||
CASE
    WHEN ((lang)::text = 'de'::text) THEN setweight(to_tsvector('german'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'file'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")
    WHEN ((lang)::text = 'it'::text) THEN setweight(to_tsvector('italian'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'file'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")
    WHEN ((lang)::text = 'es'::text) THEN setweight(to_tsvector('spanish'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'file'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")
    ELSE ''::tsvector
END) || ''::tsvector) || setweight(to_tsvector('english'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 's3File'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")) || ''::tsvector) || setweight(to_tsvector('french'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 's3File'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")) || ''::tsvector) ||
CASE
    WHEN ((lang)::text = 'de'::text) THEN setweight(to_tsvector('german'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 's3File'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")
    WHEN ((lang)::text = 'it'::text) THEN setweight(to_tsvector('italian'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 's3File'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")
    WHEN ((lang)::text = 'es'::text) THEN setweight(to_tsvector('spanish'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 's3File'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")
    ELSE ''::tsvector
END)) STORED NOT NULL,
	"order" numeric,
	CONSTRAINT "item_path_key1" UNIQUE("path")
);--> statement-breakpoint
CREATE TABLE "app_setting" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"item_id" uuid NOT NULL,
	"creator_id" uuid,
	"name" varchar NOT NULL,
	"data" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "item_login_schema" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"type" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"item_path" "ltree" NOT NULL,
	"status" varchar(100) DEFAULT 'active' NOT NULL,
	CONSTRAINT "item-login-schema" UNIQUE("item_path")
);--> statement-breakpoint
CREATE TABLE "item_flag" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"type" varchar NOT NULL,
	"creator_id" uuid,
	"item_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "item-flag-creator" UNIQUE("type","creator_id","item_id")
);--> statement-breakpoint
CREATE TABLE "item_published" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"creator_id" uuid,
	"item_path" "ltree" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "published-item" UNIQUE("item_path")
);--> statement-breakpoint
CREATE TABLE "item_geolocation" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"country" varchar(4),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"item_path" "ltree" NOT NULL,
	"addressLabel" varchar(300),
	"helperLabel" varchar(300),
	CONSTRAINT "item_geolocation_unique_item" UNIQUE("item_path")
);--> statement-breakpoint
CREATE TABLE "item_membership" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"permission" varchar(100) NOT NULL,
	"item_path" "ltree" NOT NULL,
	"creator_id" uuid,
	"account_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "item_membership-item-member" UNIQUE("item_path","account_id")
);--> statement-breakpoint
CREATE TABLE "item_validation" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"item_id" uuid NOT NULL,
	"process" varchar NOT NULL,
	"status" varchar NOT NULL,
	"result" varchar,
	"item_validation_group_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "item_validation_review" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"item_validation_id" uuid NOT NULL,
	"reviewer_id" uuid,
	"status" varchar NOT NULL,
	"reason" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "item_validation_group" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"item_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "item_visibility" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"type" varchar NOT NULL,
	"item_path" "ltree" NOT NULL,
	"creator_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "UQ_item_visibility_item_type" UNIQUE("type","item_path")
);--> statement-breakpoint
CREATE TABLE "migrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" bigint NOT NULL,
	"name" varchar NOT NULL
);--> statement-breakpoint
CREATE TABLE "recycled_item_data" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"creator_id" uuid,
	"item_path" "ltree" NOT NULL,
	CONSTRAINT "recycled-item-data" UNIQUE("item_path")
);--> statement-breakpoint
CREATE TABLE "short_link" (
	"alias" varchar(255) PRIMARY KEY NOT NULL,
	"platform" "short_link_platform_enum" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"item_id" uuid NOT NULL,
	CONSTRAINT "UQ_859a3384cadaa460b84e04e5375" UNIQUE("platform","item_id"),
	CONSTRAINT "CHK_200ef28b2168aaf1e36b6896fc" CHECK ((length((alias)::text) >= 6) AND (length((alias)::text) <= 255) AND ((alias)::text ~ '^[a-zA-Z0-9-]*$'::text))
);--> statement-breakpoint
CREATE TABLE "role" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"description" varchar(100) NOT NULL,
	CONSTRAINT "role_description_key" UNIQUE("description")
);--> statement-breakpoint
CREATE TABLE "member_profile" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"bio" varchar(5000),
	"visibility" boolean DEFAULT false NOT NULL,
	"facebookID" varchar(100),
	"linkedinID" varchar(100),
	"twitterID" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"member_id" uuid,
	CONSTRAINT "member-profile" UNIQUE("member_id")
);--> statement-breakpoint
CREATE TABLE "typeorm_metadata" (
	"type" varchar NOT NULL,
	"database" varchar,
	"schema" varchar,
	"table" varchar,
	"name" varchar,
	"value" text
);--> statement-breakpoint
CREATE TABLE "publisher" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" varchar(250) NOT NULL,
	"origins" text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "publisher_name_key" UNIQUE("name")
);--> statement-breakpoint
CREATE TABLE "member_password" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"password" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"member_id" uuid,
	CONSTRAINT "member-password" UNIQUE("member_id")
);--> statement-breakpoint
CREATE TABLE "membership_request" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"member_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	CONSTRAINT "UQ_membership_request_item-member" UNIQUE("member_id","item_id")
);--> statement-breakpoint
CREATE TABLE "item_favorite" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"member_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	CONSTRAINT "favorite_key" UNIQUE("member_id","item_id")
);--> statement-breakpoint
CREATE TABLE "item_like" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"creator_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	CONSTRAINT "id" UNIQUE("creator_id","item_id")
);--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" "tag_category_enum" NOT NULL,
	CONSTRAINT "UQ_tag_name_category" UNIQUE("name","category")
);--> statement-breakpoint
CREATE TABLE "item_tag" (
	"tag_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	CONSTRAINT "PK_a04bb2298e37d95233a0c92347e" PRIMARY KEY("tag_id","item_id"),
	CONSTRAINT "UQ_item_tag" UNIQUE("tag_id","item_id")
);--> statement-breakpoint
ALTER TABLE "app_data" ADD CONSTRAINT "FK_27cb180cb3f372e4cf55302644a" FOREIGN KEY ("creator_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_data" ADD CONSTRAINT "FK_8c3e2463c67d9865658941c9e2d" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_data" ADD CONSTRAINT "FK_app_data_account_id" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "FK_account_item_login_schema_id" FOREIGN KEY ("item_login_schema_id") REFERENCES "public"."item_login_schema"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_mention" ADD CONSTRAINT "FK_chat_mention_account_id" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_mention" ADD CONSTRAINT "FK_e5199951167b722215127651e7c" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_category" ADD CONSTRAINT "FK_5681d1785eea699e9cae8818fe0" FOREIGN KEY ("item_path") REFERENCES "public"."item"("path") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "item_category" ADD CONSTRAINT "FK_638552fc7d9a2035c2b53182d8a" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_category" ADD CONSTRAINT "FK_9a34a079b5b24f4396462546d26" FOREIGN KEY ("creator_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_request_export" ADD CONSTRAINT "FK_bc85ef3298df8c7974b33081b47" FOREIGN KEY ("member_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_request_export" ADD CONSTRAINT "FK_fea823c4374f507a68cf8f926a4" FOREIGN KEY ("item_path") REFERENCES "public"."item"("path") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "app" ADD CONSTRAINT "FK_37eb7baab82e11150157ec0b5a6" FOREIGN KEY ("publisher_id") REFERENCES "public"."publisher"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "FK_71fdcb9038eca1b903102bdfd17" FOREIGN KEY ("creator_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "FK_b31e627ea7a4787672e265a1579" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "FK_7ad4a490d5b9f79a677827b641c" FOREIGN KEY ("creator_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "FK_dc1d92accde1c2fbb7e729e4dcc" FOREIGN KEY ("item_path") REFERENCES "public"."item"("path") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "app_action" ADD CONSTRAINT "FK_app_action_account_id" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_action" ADD CONSTRAINT "FK_c415fc186dda51fa260d338d776" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action" ADD CONSTRAINT "FK_1214f6f4d832c402751617361c0" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action" ADD CONSTRAINT "FK_action_account_id" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_password" ADD CONSTRAINT "FK_guest_password_guest_id" FOREIGN KEY ("guest_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "FK_bdc46717fadc2f04f3093e51fd5" FOREIGN KEY ("creator_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_setting" ADD CONSTRAINT "FK_22d3d051ee6f94932c1373a3d09" FOREIGN KEY ("creator_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_setting" ADD CONSTRAINT "FK_f5922b885e2680beab8add96008" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_login_schema" ADD CONSTRAINT "FK_b4a263d8c8392a73e0a1febf7d3" FOREIGN KEY ("item_path") REFERENCES "public"."item"("path") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "item_flag" ADD CONSTRAINT "FK_b04d0adf4b73d82537c92fa55ea" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_flag" ADD CONSTRAINT "FK_bde9b9ab1da1483a71c9b916dd2" FOREIGN KEY ("creator_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_published" ADD CONSTRAINT "FK_490fddd9099ee7ddcccf8c776a1" FOREIGN KEY ("item_path") REFERENCES "public"."item"("path") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "item_published" ADD CONSTRAINT "FK_bfeeeb8d1257029e4d7f7ec1375" FOREIGN KEY ("creator_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_geolocation" ADD CONSTRAINT "FK_66d4b13df4e7765068c8268d719" FOREIGN KEY ("item_path") REFERENCES "public"."item"("path") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "item_membership" ADD CONSTRAINT "FK_25b6506de99e92886ed97174ab8" FOREIGN KEY ("creator_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_membership" ADD CONSTRAINT "FK_d935785e7ecc015ed3ca048ff05" FOREIGN KEY ("item_path") REFERENCES "public"."item"("path") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "item_membership" ADD CONSTRAINT "FK_item_membership_account_id" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_validation" ADD CONSTRAINT "FK_d60969d5e478e7c844532ac4e7f" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_validation" ADD CONSTRAINT "FK_e92da280941f666acf87baedc65" FOREIGN KEY ("item_validation_group_id") REFERENCES "public"."item_validation_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_validation_review" ADD CONSTRAINT "FK_44bf14fee580ae08702d70e622e" FOREIGN KEY ("reviewer_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_validation_review" ADD CONSTRAINT "FK_59fd000835c70c728e525d82950" FOREIGN KEY ("item_validation_id") REFERENCES "public"."item_validation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_validation_group" ADD CONSTRAINT "FK_a9e83cf5f53c026b774b53d3c60" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_visibility" ADD CONSTRAINT "FK_item_visibility_creator" FOREIGN KEY ("creator_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_visibility" ADD CONSTRAINT "FK_item_visibility_item" FOREIGN KEY ("item_path") REFERENCES "public"."item"("path") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "recycled_item_data" ADD CONSTRAINT "FK_3e3650ebd5c49843013429d510a" FOREIGN KEY ("creator_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recycled_item_data" ADD CONSTRAINT "FK_f8a4db4476e3d81e18de5d63c42" FOREIGN KEY ("item_path") REFERENCES "public"."item"("path") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "short_link" ADD CONSTRAINT "FK_43c8a0471d5e58f99fc9c36b991" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "member_profile" ADD CONSTRAINT "FK_91fa43bc5482dc6b00892baf016" FOREIGN KEY ("member_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_password" ADD CONSTRAINT "FK_member_password_member_id" FOREIGN KEY ("member_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_request" ADD CONSTRAINT "FK_membership_request_item_id" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_request" ADD CONSTRAINT "FK_membership_request_member_id" FOREIGN KEY ("member_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_favorite" ADD CONSTRAINT "FK_10ea93bde287762010695378f94" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "item_favorite" ADD CONSTRAINT "FK_a169d350392956511697f7e7d38" FOREIGN KEY ("member_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_like" ADD CONSTRAINT "FK_159827eb667d019dc71372d7463" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_like" ADD CONSTRAINT "FK_4a56eba1ce30dc93f118a51ff26" FOREIGN KEY ("creator_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tag" ADD CONSTRAINT "FK_16ab8afb42f763f7cbaa4bff66a" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tag" ADD CONSTRAINT "FK_39b492fda03c7ac846afe164b58" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_6079b3bb63c13f815f7dd8d8a2" ON "app_data" USING btree ("type" text_ops);--> statement-breakpoint
CREATE INDEX "IDX_account_type" ON "account" USING btree ("type" text_ops);--> statement-breakpoint
CREATE INDEX "IDX_1214f6f4d832c402751617361c" ON "action" USING btree ("item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "IDX_action_account_id" ON "action" USING btree ("account_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "IDX_bdc46717fadc2f04f3093e51fd" ON "item" USING btree ("creator_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "IDX_gin_item_search_document" ON "item" USING gin ("search_document" tsvector_ops);--> statement-breakpoint
CREATE INDEX "IDX_gist_item_path" ON "item" USING gist ("path" gist_ltree_ops);--> statement-breakpoint
CREATE INDEX "IDX_61546c650608c1e68789c64915" ON "app_setting" USING btree ("item_id" uuid_ops,"name" text_ops);--> statement-breakpoint
CREATE INDEX "IDX_gist_item_published_path" ON "item_published" USING gist ("item_path" gist_ltree_ops);--> statement-breakpoint
CREATE INDEX "IDX_5ac5bdde333fca6bbeaf177ef9" ON "item_membership" USING btree ("permission" text_ops);--> statement-breakpoint
CREATE INDEX "IDX_d935785e7ecc015ed3ca048ff0" ON "item_membership" USING btree ("item_path" ltree_ops);--> statement-breakpoint
CREATE INDEX "IDX_gist_item_membership_path" ON "item_membership" USING gist ("item_path" gist_ltree_ops);--> statement-breakpoint
CREATE INDEX "IDX_item_membership_account_id" ON "item_membership" USING btree ("account_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "IDX_item_membership_account_id_permission" ON "item_membership" USING btree ("account_id" uuid_ops,"permission" text_ops);--> statement-breakpoint
CREATE INDEX "IDX_gist_item_visibility_path" ON "item_visibility" USING gist ("item_path" gist_ltree_ops);--> statement-breakpoint
CREATE INDEX "IDX_43c8a0471d5e58f99fc9c36b99" ON "short_link" USING btree ("item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "IDX_91fa43bc5482dc6b00892baf01" ON "member_profile" USING btree ("member_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "IDX_item_like_item" ON "item_like" USING btree ("item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "IDX_item_tag_item" ON "item_tag" USING btree ("item_id" uuid_ops);

-- -- -- -- -- -- -- -- -- -- -- -- -- --
-- TYPEORM MIGRATION - Comment up to here
-- -- -- -- -- -- -- -- -- -- -- -- -- --

-- Keep this is you migrate from typeorm
create table "test" (id text not null);--> statement-breakpoint
drop table "test";
