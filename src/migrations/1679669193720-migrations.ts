import { MigrationInterface, QueryRunner } from 'typeorm';

export class migrations1679669193721 implements MigrationInterface {
    name = 'migrations1679669193721';

    public async up(queryRunner: QueryRunner): Promise<void> {

        // -- CREATE everything
        await queryRunner.query('CREATE TYPE "member_type_enum" AS ENUM ("individual", "group")');
        await queryRunner.query(`CREATE TABLE "member" (
          "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
          "name" character varying(300) NOT NULL,
          "email" character varying(150) UNIQUE NOT NULL,
          "password" character(60) DEFAULT NULL,
          "type" member_type_enum DEFAULT "individual" NOT NULL,
          "extra" jsonb NOT NULL DEFAULT "{}"::jsonb,
        
          "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE "utc"),
          "updated_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE "utc")`
        );

        await queryRunner.query(`CREATE TABLE "item" (
            "id" uuid PRIMARY KEY, -- generated programatically and passed on insertion
            "name" character varying(500) NOT NULL,
            "description" character varying(5000),
            "type" character varying(100),
            "path" ltree UNIQUE NOT NULL,
            "extra" jsonb NOT NULL DEFAULT "{}"::jsonb,
            "settings" jsonb NOT NULL DEFAULT "{}"::jsonb,
          
            "creator" uuid REFERENCES "member" ("id") ON DELETE SET NULL, 
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE "utc"),
            "updated_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE "utc")
            )`
        );
        await queryRunner.query('CREATE INDEX "item_path_idx" ON "item" USING gist ("path")');
        await queryRunner.query('CREATE INDEX "item_creator_idx" ON item("creator")');
        await queryRunner.query(' CREATE INDEX "item_type_idx" ON item("type")');

        await queryRunner.query('CREATE TYPE "permissions_enum" AS ENUM ("read", "write", "admin")');
        await queryRunner.query(`CREATE TABLE "item_membership" (
          "id" uuid UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
          -- delete row if member is deleted
          "member_id" uuid REFERENCES "member" ("id") ON DELETE CASCADE,
          -- delete row if item is deleted; update path if item\'s path is updated.
          "item_path" ltree REFERENCES "item" ("path") ON DELETE CASCADE ON UPDATE CASCADE,
          "permission" permissions_enum NOT NULL,
          "creator" uuid REFERENCES "member" ("id") ON DELETE SET NULL, -- don"t remove - set creator to NULL
        
          "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE "utc"),
          "updated_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE "utc"),
          PRIMARY KEY ("member_id", "item_path")
        )`);
        await queryRunner.query(' CREATE INDEX "item_membership_item_path_idx" ON "item_membership" USING gist ("item_path")');

        // -- Tables timestamps
        await queryRunner.query(` CREATE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = (NOW() AT TIME ZONE "utc");
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql`);

        await queryRunner.query(` CREATE TRIGGER "member_set_timestamp"
        BEFORE UPDATE ON "member"
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp()`);

        await queryRunner.query(` CREATE TRIGGER "item_set_timestamp"
        BEFORE UPDATE ON "item"
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp()`);

        await queryRunner.query(`CREATE TRIGGER "item_membership_set_timestamp"
        BEFORE UPDATE ON "item_membership"
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp()`);

        // -- Graasp member
        await queryRunner.query(` INSERT INTO "member" ("id", "name", "email")
        VALUES ("12345678-1234-1234-1234-123456789012", "Graasp", "graasp@graasp.org")`);

        await queryRunner.query(`CREATE TABLE "action" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            "member_id" uuid REFERENCES "member" ("id") ON DELETE SET NULL,
            "item_id" uuid REFERENCES "item" ("id") ON DELETE SET NULL,
            "member_type" character varying(100),
            "item_type" character varying(100),
            "action_type" character varying(100),
            "view" character varying(100),
            "geolocation" jsonb DEFAULT '{}'::jsonb,
            "extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
        )`);

        await queryRunner.query(`CREATE TABLE "action_request_export" (
          "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
          "member_id" uuid REFERENCES "member" ("id") ON DELETE CASCADE,
          "item_id" uuid REFERENCES "item" ("id") ON DELETE CASCADE,
          "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
        )`);

        await queryRunner.query(`ALTER TABLE action
            ADD item_path ltree REFERENCES "item" ("path") ON DELETE SET NULL ON UPDATE CASCADE`);

        await queryRunner.query(`UPDATE action as a1 SET item_path = 
            (SELECT path FROM item WHERE a1.item_id = item.id)`);

        await queryRunner.query('ALTER TABLE action DROP COLUMN item_id');

        await queryRunner.query('CREATE INDEX "action_item_path_idx" ON "action" USING gist ("item_path")');

        await queryRunner.query('CREATE INDEX "action_view_idx" ON action("view")');

        await queryRunner.query(`CREATE TABLE "invitation" (
            "id" uuid UNIQUE DEFAULT uuid_generate_v4(),
            "creator" uuid REFERENCES "member" ("id") ON DELETE CASCADE,
            "item_path" ltree REFERENCES "item" ("path") ON DELETE CASCADE ON UPDATE CASCADE,
            "name" character varying(100) DEFAULT NULL,
            "email" character varying(100) NOT NULL,
            "permission" permissions_enum NOT NULL,
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            "updated_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            PRIMARY KEY ("item_path","email")
        )`);

        await queryRunner.query(`  CREATE TRIGGER "invitation_set_timestamp"
            BEFORE UPDATE ON "invitation"
            FOR EACH ROW
            EXECUTE PROCEDURE trigger_set_timestamp()`);

        await queryRunner.query(` CREATE TABLE "recycled_item" (
            "id" uuid PRIMARY KEY UNIQUE NOT NULL DEFAULT uuid_generate_v4(), -- generated programatically and passed on insertion
            "item_id" uuid UNIQUE NOT NULL REFERENCES "item" ("id") ON DELETE CASCADE,
            "item_path" ltree UNIQUE NOT NULL REFERENCES "item" ("path") ON DELETE CASCADE ON UPDATE CASCADE,
            "creator" uuid REFERENCES "member" ("id") ON DELETE SET NULL, -- don't remove item - set creator to NULL
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
        )`);

        await queryRunner.query('CREATE TYPE "nested_tag_enum" AS ENUM (\'allow\', \'fail\')');

        await queryRunner.query(`CREATE TABLE "tag" (
          "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
          -- 'name' might not be the final label for the user but a (recognizable) short english label that behaves as a key for translation
          "name" character varying(100) NOT NULL,
          -- "creator" uuid REFERENCES "member" ("id") ON DELETE SET NULL, -- don't remove - set creator to NULL
          "nested" nested_tag_enum DEFAULT NULL,
          "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
        )`);
        
        await queryRunner.query(`CREATE TABLE "item_tag" (
          "id" uuid UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
          -- delete row if tag is deleted
          "tag_id" uuid REFERENCES "tag" ("id") ON DELETE CASCADE,
          -- delete row if item is deleted; update path if item's path is updated.
          "item_path" ltree REFERENCES "item" ("path") ON DELETE CASCADE ON UPDATE CASCADE,
          "creator" uuid REFERENCES "member" ("id") ON DELETE SET NULL, -- don't remove - set creator to NULL
        
          "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
          PRIMARY KEY ("tag_id", "item_path")
        )`);
        
        await queryRunner.query('CREATE INDEX "item_tag_item_path_idx" ON "item_tag" USING gist ("item_path")');

        await queryRunner.query(`CREATE TABLE IF NOT EXISTS category_type (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            name VARCHAR(20)
        )`);
        await queryRunner.query(`INSERT INTO category_type (id, name)
        VALUES ('3f7b79e2-7e78-4aea-b697-2b6a6ba92e91', 'level'),
            ('c344bf4f-19e0-4674-b2a2-06bb5ac6e11c', 'discipline')`);
            await queryRunner.query(`CREATE TABLE IF NOT EXISTS category (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            name VARCHAR(50),
            type uuid,
            FOREIGN KEY (type) REFERENCES category_type("id") ON DELETE CASCADE
        )`);
        await queryRunner.query(`INSERT INTO category (name, type)
        VALUES (
                'Kindergarden',
                '3f7b79e2-7e78-4aea-b697-2b6a6ba92e91'
            ),
            (
                'Primary School',
                '3f7b79e2-7e78-4aea-b697-2b6a6ba92e91'
            ),
            (
                'Lower Secondary School',
                '3f7b79e2-7e78-4aea-b697-2b6a6ba92e91'
            ),
            (
                'Upper Secondary School',
                '3f7b79e2-7e78-4aea-b697-2b6a6ba92e91'
            ),
            (
                'Vocational Training',
                '3f7b79e2-7e78-4aea-b697-2b6a6ba92e91'
            ),
            (
                'Higher Education',
                '3f7b79e2-7e78-4aea-b697-2b6a6ba92e91'
            ),
            ('Math', 'c344bf4f-19e0-4674-b2a2-06bb5ac6e11c'),
            (
                'Language',
                'c344bf4f-19e0-4674-b2a2-06bb5ac6e11c'
            ),
            (
                'Natural Science',
                'c344bf4f-19e0-4674-b2a2-06bb5ac6e11c'
            ),
            (
                'Social Science',
                'c344bf4f-19e0-4674-b2a2-06bb5ac6e11c'
            ),
            (
                'Literature',
                'c344bf4f-19e0-4674-b2a2-06bb5ac6e11c'
            ),
            ('Arts', 'c344bf4f-19e0-4674-b2a2-06bb5ac6e11c')`);
        
        // -- CREATE item_category table
        await queryRunner.query(` CREATE TABLE item_category (
            id uuid DEFAULT uuid_generate_v4(),
            item_id uuid,
            category_id uuid,
            PRIMARY KEY(item_id, category_id),
            FOREIGN KEY(item_id) REFERENCES item(id) ON DELETE CASCADE,
            FOREIGN KEY(category_id) REFERENCES category(id) ON DELETE CASCADE
        )`);
        
        // -- Add language categories
        await queryRunner.query(`INSERT INTO category_type (id, name)
        VALUES ('34bf2823-480a-4dd7-9c0f-8b5bfbdec380', 'language')`);
        
        await queryRunner.query(`INSERT INTO category (name, type)
        VALUES ('English', '34bf2823-480a-4dd7-9c0f-8b5bfbdec380'),
        ('French', '34bf2823-480a-4dd7-9c0f-8b5bfbdec380'),
        ('German', '34bf2823-480a-4dd7-9c0f-8b5bfbdec380')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // do nothing

    }

}
