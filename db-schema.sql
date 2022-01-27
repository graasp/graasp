-- CREATE necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "ltree";

-- CREATE everything
CREATE TYPE "member_type_enum" AS ENUM ('individual', 'group');
CREATE TABLE "member" (
  "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  "name" character varying(300) NOT NULL,
  "email" character varying(150) UNIQUE NOT NULL,
  "type" member_type_enum DEFAULT 'individual' NOT NULL,
  "extra" jsonb NOT NULL DEFAULT '{}'::jsonb,

  "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
  "updated_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE TABLE "item" (
  "id" uuid PRIMARY KEY, -- generated programatically and passed on insertion
  "name" character varying(500) NOT NULL,
  "description" character varying(5000),
  "type" character varying(100),
  "path" ltree UNIQUE NOT NULL,
  "extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,

  "creator" uuid REFERENCES "member" ("id") ON DELETE SET NULL, -- don't remove item - set creator to NULL
  "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
  "updated_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);
CREATE INDEX "item_path_idx" ON "item" USING gist ("path");
CREATE INDEX "item_creator_idx" ON item("creator");
CREATE INDEX "item_type_idx" ON item("type");

CREATE TYPE "permissions_enum" AS ENUM ('read', 'write', 'admin');
CREATE TABLE "item_membership" (
  "id" uuid UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  -- delete row if member is deleted
  "member_id" uuid REFERENCES "member" ("id") ON DELETE CASCADE,
  -- delete row if item is deleted; update path if item's path is updated.
  "item_path" ltree REFERENCES "item" ("path") ON DELETE CASCADE ON UPDATE CASCADE,
  "permission" permissions_enum NOT NULL,
  "creator" uuid REFERENCES "member" ("id") ON DELETE SET NULL, -- don't remove - set creator to NULL

  "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
  "updated_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
  PRIMARY KEY ("member_id", "item_path")
);
CREATE INDEX "item_membership_item_path_idx" ON "item_membership" USING gist ("item_path");

-- Tables timestamps
CREATE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = (NOW() AT TIME ZONE 'utc');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "member_set_timestamp"
BEFORE UPDATE ON "member"
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER "item_set_timestamp"
BEFORE UPDATE ON "item"
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER "item_membership_set_timestamp"
BEFORE UPDATE ON "item_membership"
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- Graasp member
INSERT INTO "member" ("id", "name", "email")
VALUES ('12345678-1234-1234-1234-123456789012', 'Graasp', 'graasp@graasp.org');
