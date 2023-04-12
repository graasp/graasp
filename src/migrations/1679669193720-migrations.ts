import { MigrationInterface, QueryRunner } from 'typeorm';

export class migrations1679669193720 implements MigrationInterface {
  name = 'migrations1679669193720';

  // create all initial tables
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TYPE "member_type_enum" AS ENUM (\'individual\', \'group\')');
    await queryRunner.query(`CREATE TABLE "member" (
          "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
          "name" character varying(300) NOT NULL,
          "email" character varying(150) UNIQUE NOT NULL,
          "password" character(60) DEFAULT NULL,
          "type" member_type_enum  NOT NULL DEFAULT 'individual',
          "extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
        
          "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
          "updated_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'))`);

    await queryRunner.query(`CREATE TABLE "item" (
            "id" uuid PRIMARY KEY, -- generated programatically and passed on insertion
            "name" character varying(500) NOT NULL,
            "description" character varying(5000),
            "type" character varying(100),
            "path" ltree UNIQUE NOT NULL,
            "extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
            "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
          
            "creator" uuid REFERENCES "member" ("id") ON DELETE SET NULL, 
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            "updated_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
            )`);
    await queryRunner.query('CREATE INDEX "item_path_idx" ON "item" USING gist ("path")');
    await queryRunner.query('CREATE INDEX "item_creator_idx" ON item("creator")');
    await queryRunner.query(' CREATE INDEX "item_type_idx" ON item("type")');

    await queryRunner.query('CREATE TYPE "permissions_enum" AS ENUM (\'read\', \'write\', \'admin\')');
    await queryRunner.query(`CREATE TABLE "item_membership" (
          "id" uuid UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
          -- delete row if member is deleted
          "member_id" uuid REFERENCES "member" ("id") ON DELETE CASCADE,
          -- delete row if item is deleted; update path if item\'s path is updated.
          "item_path" ltree REFERENCES "item" ("path") ON DELETE CASCADE ON UPDATE CASCADE,
          "permission" permissions_enum NOT NULL,
          "creator" uuid REFERENCES "member" ("id") ON DELETE SET NULL, -- don"t remove - set creator to NULL
        
          "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE \'utc\'),
          "updated_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE \'utc\'),
            PRIMARY KEY ("member_id", "item_path")
            )`);
    await queryRunner.query(
      ' CREATE INDEX "item_membership_item_path_idx" ON "item_membership" USING gist ("item_path")',
    );

    // -- Tables timestamps
    await queryRunner.query(` CREATE OR REPLACE FUNCTION trigger_set_timestamp()
            RETURNS TRIGGER AS $$
            BEGIN
            NEW.updated_at = (NOW() AT TIME ZONE \'utc\');
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
            VALUES ('12345678-1234-1234-1234-123456789012', 'Graasp', 'graasp@graasp.org')`);

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

    await queryRunner.query(
      'CREATE INDEX "action_item_path_idx" ON "action" USING gist ("item_path")',
    );

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

    await queryRunner.query(
      'CREATE INDEX "item_tag_item_path_idx" ON "item_tag" USING gist ("item_path")',
    );

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

    // -- create table for different validation processes
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS item_validation_process (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            description VARCHAR(500),
            name VARCHAR(100) NOT NULL,
            enabled BOOLEAN NOT NULL
            )`);

    // -- insert initial processes
    await queryRunner.query(`INSERT INTO item_validation_process (name, description, enabled)
            VALUES ('bad-words-detection', 'check all text fields for bad words', TRUE),
            ('aggressive-langauge-classification', 'automatically classify the description if it is considered aggressive or hate speech', FALSE),
            ('image-classification', 'automatically classify image if it contains nudify or not', FALSE)`);

    // -- create tables for validation and review statuses
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS item_validation_status (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            name VARCHAR(50) NOT NULL
            )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS item_validation_review_status (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            name VARCHAR(50) NOT NULL
            )`);

    await queryRunner.query(`INSERT INTO item_validation_status (name)
            VALUES ('pending'),
            ('success'),
            ('failure')`);

    await queryRunner.query(`INSERT INTO item_validation_review_status (name)
            VALUES ('pending'),
            ('accepted'),
            ('rejected')`);

    // -- create table for automatic validation records
    // -- one record for each validation attempt
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS item_validation (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            item_id UUID NOT NULL REFERENCES item("id") ON DELETE CASCADE,
            created_at timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
            )`);

    // -- one record for each process
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS item_validation_group (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            item_id UUID NOT NULL REFERENCES item("id") ON DELETE CASCADE,
            item_validation_id UUID NOT NULL REFERENCES item_validation("id") ON DELETE CASCADE,
            item_validation_process_id UUID NOT NULL REFERENCES item_validation_process("id") ON DELETE CASCADE,
            status_id UUID NOT NULL REFERENCES item_validation_status("id") ON DELETE CASCADE,
            result VARCHAR(50),
            updated_at timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            created_at timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
            )`);

    // -- create table for manual validation records
    // -- one record for each validation process that needs manual review
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS item_validation_review (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            item_validation_id UUID NOT NULL REFERENCES item_validation("id") ON DELETE CASCADE,
            reviewer_id UUID REFERENCES member("id") ON DELETE CASCADE,
            status_id UUID NOT NULL REFERENCES item_validation_review_status("id") ON DELETE CASCADE,
            reason VARCHAR(100),
            updated_at timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            created_at timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
            )`);

    await queryRunner.query(
      'INSERT INTO "tag" ("id", "name", "nested") VALUES (\'6230a72d-59c2-45c2-a8eb-e2a01a3ac05b\', \'item-login\', \'fail\')',
    );

    await queryRunner.query(`CREATE TABLE "item_member_login" (
            "item_id" uuid REFERENCES "item" ("id") ON DELETE CASCADE,
            "member_id" uuid REFERENCES "member" ("id") ON DELETE CASCADE,
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            PRIMARY KEY ("item_id", "member_id")
            )`);

    await queryRunner.query(`CREATE TABLE "chat_message" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,                
            "chat_id" uuid REFERENCES "item" ("id") ON DELETE CASCADE,       
            "creator" uuid REFERENCES "member" ("id") ON DELETE SET NULL,   
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            "updated_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            "body" character varying(500)
        )`);

    await queryRunner.query('CREATE INDEX ON "chat_message" ("chat_id")');

    await queryRunner.query('CREATE INDEX ON "chat_message" ("id", "chat_id")');

    await queryRunner.query('CREATE INDEX ON "chat_message" ("created_at")');

    await queryRunner.query(`CREATE TRIGGER "chat_message_set_timestamp"
            BEFORE UPDATE ON "chat_message"
            FOR EACH ROW
            EXECUTE PROCEDURE trigger_set_timestamp()`);

    await queryRunner.query('DROP TRIGGER chat_message_set_timestamp ON chat_message');
    await queryRunner.query('alter table chat_message drop updated_at');
    await queryRunner.query(`ALTER TABLE chat_message
            ADD COLUMN updated_at timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')`);
    await queryRunner.query('UPDATE chat_message set updated_at = created_at');
    await queryRunner.query(`CREATE TRIGGER "chat_message_set_timestamp"
            BEFORE UPDATE
            ON "chat_message"
            FOR EACH ROW
            EXECUTE PROCEDURE trigger_set_timestamp()`);

    await queryRunner.query('CREATE TYPE mention_status AS ENUM (\'unread\', \'read\')');

    await queryRunner.query(`CREATE TABLE "chat_mention" 
            (
                "id"         uuid UNIQUE    NOT NULL DEFAULT uuid_generate_v4(),
                "item_path"  ltree REFERENCES "item" ("path") ON DELETE CASCADE,          -- delete row if item is deleted
                "message_id" uuid REFERENCES "chat_message" ("id") ON DELETE CASCADE,      -- delete row if member is deleted
                "member_id"  uuid REFERENCES "member" ("id") ON DELETE CASCADE,            -- delete row if member is deleted
                "creator"    uuid           REFERENCES "member" ("id") ON DELETE SET NULL, -- don't remove - set creator to NULL
                "created_at" timestamp      NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
                "updated_at" timestamp      NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
                "status"     mention_status NOT NULL DEFAULT 'unread',
                PRIMARY KEY ("id")
            )`);

    await queryRunner.query('CREATE INDEX ON "chat_mention" ("member_id")'); // -- optimize lookup by member_id

    await queryRunner.query(`CREATE TRIGGER "chat_mention_set_timestamp"
            BEFORE UPDATE
            ON "chat_mention"
            FOR EACH ROW
            EXECUTE PROCEDURE trigger_set_timestamp()`);

    await queryRunner.query(`CREATE TABLE "flag" (
                "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
                "name" character varying(100) NOT NULL
              )`);

    await queryRunner.query(`CREATE TABLE "item_flag" (
                "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
                "flag_id" uuid REFERENCES "flag" ("id") ON DELETE CASCADE,
                "item_id" uuid REFERENCES "item" ("id") ON DELETE CASCADE,
                "creator" uuid REFERENCES "member" ("id") ON DELETE SET NULL,
                "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
              )`);

    await queryRunner.query(
      'INSERT INTO flag VALUES (\'053d9c35-182e-41d8-9f1f-2f5b443d0fbd\', \'Inappropriate Content\')',
    );
    await queryRunner.query(
      'INSERT INTO flag VALUES (\'69f652a7-9c04-4346-b963-004e63c478b9\', \'Hate speech\')',
    );
    await queryRunner.query(
      'INSERT INTO flag VALUES (\'a1ebd159-416a-404b-b893-02a7064454db\', \'Fraud / Plagiarism\')',
    );
    await queryRunner.query(
      ' INSERT INTO flag VALUES (\'7463afaa-a74e-4a5c-810c-44f9642c87c5\', \'Spam\')',
    );
    await queryRunner.query(
      ' INSERT INTO flag VALUES (\'ca6d1841-fabc-4444-b86e-b76af41263c1\', \'Targeted Harrasment\')',
    );
    await queryRunner.query(
      ' INSERT INTO flag VALUES (\'9baecb0e-3dc3-4191-bbf7-2a89d304600b\', \'False Information\')',
    );

    await queryRunner.query(`CREATE TABLE "publisher" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            "name" character varying(250) NOT NULL,
            "origins" character varying(100)[],
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
        )`);

    await queryRunner.query(`CREATE TABLE "app" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        
            "name" character varying(250) NOT NULL,
            "description" character varying(250) NOT NULL,
        
            "url" character varying(250) NOT NULL,
            "publisher_id" uuid REFERENCES "publisher" ("id") ON DELETE CASCADE NOT NULL,
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
        
            "extra" jsonb NOT NULL DEFAULT '{}'::jsonb
        )`);

    /**
     * the same as above
     */
    await queryRunner.query(
      'CREATE TYPE "app_data_visibility_enum" AS ENUM (\'member\', \'item\'); --, \'app\', \'publisher\')',
    );

    await queryRunner.query(`CREATE TABLE "app_data" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        
            -- delete row if member is deleted
            "member_id" uuid REFERENCES "member" ("id") ON DELETE CASCADE NOT NULL,
            -- "session_id" character varying(25), -- TODO: maybe necessary for "public use".
        
            -- delete row if item is deleted
            "item_id" uuid REFERENCES "item" ("id") ON DELETE CASCADE NOT NULL,
        
            "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
            "type" character varying(25),
        
            -- don't remove - set creator to NULL
            "creator" uuid REFERENCES "member" ("id") ON DELETE SET NULL,
        
            -- "ownership" app_data_ownership_enum DEFAULT 'member' NOT NULL,
            "visibility" app_data_visibility_enum DEFAULT 'member' NOT NULL,
        
            -- TODO: I think this is to discard; maybe item should keep a reference to the appId in its settings?
            -- "app_id" uuid REFERENCES "app" ("id"), -- must be set if ownership != ('member' or 'item')
            -- "publisher_id" uuid REFERENCES "publisher" ("id"), -- must be set if ownership != ('member' or 'item')
        
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            "updated_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
        )`);
    await queryRunner.query('CREATE INDEX "app_data_item_id_idx" ON app_data("item_id")');

    await queryRunner.query(`CREATE TRIGGER "app_data_set_timestamp"
            BEFORE UPDATE ON "app_data"
            FOR EACH ROW
            EXECUTE PROCEDURE trigger_set_timestamp()`);

    await queryRunner.query(`CREATE TABLE "app_action" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            "member_id" uuid REFERENCES "member" ("id") ON DELETE CASCADE NOT NULL,
            "item_id" uuid REFERENCES "item" ("id") ON DELETE CASCADE NOT NULL,
            "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
            "type" character varying(25),
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
        )`);
    await queryRunner.query('CREATE INDEX "app_action_item_id_idx" ON app_action("item_id")');

    await queryRunner.query(`CREATE TABLE "app_setting" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        
            -- delete row if item is deleted
            "item_id" uuid REFERENCES "item" ("id") ON DELETE CASCADE NOT NULL,
        
            "name" character varying(250) NOT NULL,
        
            "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
        
            -- don't remove - set creator to NULL
            "creator" uuid REFERENCES "member" ("id") ON DELETE SET NULL,
        
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            "updated_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
        )`);
    await queryRunner.query('CREATE INDEX "app_setting_item_id_idx" ON app_setting("item_id")');

    await queryRunner.query(`CREATE TRIGGER "app_setting_set_timestamp"
            BEFORE UPDATE ON "app_setting"
            FOR EACH ROW
            EXECUTE PROCEDURE trigger_set_timestamp()`);

    await queryRunner.query(`CREATE TABLE item_like (
            id uuid DEFAULT uuid_generate_v4(),
            item_id uuid NOT NULL REFERENCES item("id") ON DELETE CASCADE,
                member_id uuid NOT NULL REFERENCES member("id") ON DELETE CASCADE,
                created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
                PRIMARY KEY (item_id, member_id)
                )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // drop all tables
    await queryRunner.query('DROP TABLE IF EXISTS action');
    await queryRunner.query('DROP TABLE IF EXISTS action_request_export');
    await queryRunner.query('DROP TABLE IF EXISTS admin_role');
    await queryRunner.query('DROP TABLE IF EXISTS app');
    await queryRunner.query('DROP TABLE IF EXISTS app_data');
    await queryRunner.query('DROP TABLE IF EXISTS app_action');
    await queryRunner.query('DROP TABLE IF EXISTS app_setting');
    await queryRunner.query('DROP TABLE IF EXISTS chat_mention');
    await queryRunner.query('DROP TABLE IF EXISTS chat_message');
    await queryRunner.query('DROP TABLE IF EXISTS invitation');
    await queryRunner.query('DROP TABLE IF EXISTS item_category');
    await queryRunner.query('DROP TABLE IF EXISTS item_flag');
    await queryRunner.query('DROP TABLE IF EXISTS flag');
    await queryRunner.query('DROP TABLE IF EXISTS item_like');
    await queryRunner.query('DROP TABLE IF EXISTS item_member_login');
    await queryRunner.query('DROP TABLE IF EXISTS item_membership');
    await queryRunner.query('DROP TABLE IF EXISTS item_tag');
    await queryRunner.query('DROP TABLE IF EXISTS category');
    await queryRunner.query('DROP TABLE IF EXISTS category_type');
    await queryRunner.query('DROP TABLE IF EXISTS item_validation_group');
    await queryRunner.query('DROP TABLE IF EXISTS item_validation_review');
    await queryRunner.query('DROP TABLE IF EXISTS item_validation_process');
    await queryRunner.query('DROP TABLE IF EXISTS item_validation_status');
    await queryRunner.query('DROP TABLE IF EXISTS item_validation_review_status');
    await queryRunner.query('DROP TABLE IF EXISTS item_validation');
    await queryRunner.query('DROP TABLE IF EXISTS permission');
    await queryRunner.query('DROP TABLE IF EXISTS publisher');
    await queryRunner.query('DROP TABLE IF EXISTS recycled_item');
    await queryRunner.query('DROP TABLE IF EXISTS role_permission');
    await queryRunner.query('DROP TABLE IF EXISTS tag');
    await queryRunner.query('DROP TABLE IF EXISTS item');
    await queryRunner.query('DROP TABLE IF EXISTS member');

    await queryRunner.query('DROP TYPE IF EXISTS "permissions_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS mention_status');
    await queryRunner.query('DROP TYPE IF EXISTS "app_data_visibility_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "nested_tag_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "member_type_enum"');
  }
}
