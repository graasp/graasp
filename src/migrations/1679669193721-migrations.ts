import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1679669193721 implements MigrationInterface {
  name = 'migrations1679669193721';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // rename all tables to old
    await queryRunner.query('ALTER TABLE action RENAME TO action_old');
    await queryRunner.query(
      'ALTER TABLE action_request_export RENAME TO action_request_export_old',
    );
    // don't use we never used admin_role anymore
    await queryRunner.query('DROP TABLE IF EXISTS admin_role');
    await queryRunner.query('ALTER TABLE app RENAME TO app_old');
    await queryRunner.query('ALTER TABLE app_data RENAME TO app_data_old');
    await queryRunner.query('ALTER TABLE app_action RENAME TO app_action_old');
    await queryRunner.query('ALTER TABLE app_setting RENAME TO app_setting_old');
    await queryRunner.query('ALTER TABLE category RENAME TO category_old');
    await queryRunner.query('ALTER TABLE category_type RENAME TO category_type_old');
    await queryRunner.query('ALTER TABLE chat_mention RENAME TO chat_mention_old');
    await queryRunner.query('ALTER TABLE chat_message RENAME TO chat_message_old');
    await queryRunner.query('ALTER TABLE flag RENAME TO flag_old');
    await queryRunner.query('ALTER TABLE invitation RENAME TO invitation_old');
    await queryRunner.query('ALTER TABLE item RENAME TO item_old');
    await queryRunner.query('ALTER TABLE item_category RENAME TO item_category_old');
    await queryRunner.query('ALTER TABLE item_flag RENAME TO item_flag_old');
    await queryRunner.query('ALTER TABLE item_like RENAME TO item_like_old');
    await queryRunner.query('ALTER TABLE item_member_login RENAME TO item_member_login_old');
    await queryRunner.query('ALTER TABLE item_membership RENAME TO item_membership_old');
    await queryRunner.query('ALTER TABLE item_tag RENAME TO item_tag_old');
    await queryRunner.query('ALTER TABLE item_validation RENAME TO item_validation_old');
    await queryRunner.query(
      'ALTER TABLE item_validation_group RENAME TO item_validation_group_old',
    );
    await queryRunner.query(
      'ALTER TABLE item_validation_review RENAME TO item_validation_review_old',
    );
    await queryRunner.query(
      'ALTER TABLE item_validation_process RENAME TO item_validation_process_old',
    );
    await queryRunner.query(
      'ALTER TABLE item_validation_status RENAME TO item_validation_status_old',
    );
    await queryRunner.query(
      'ALTER TABLE item_validation_review_status RENAME TO item_validation_review_status_old',
    );
    await queryRunner.query('ALTER TABLE member RENAME TO member_old');
    // don't use permission (admin?)
    await queryRunner.query('DROP TABLE IF EXISTS permission');
    await queryRunner.query('ALTER TABLE publisher RENAME TO publisher_old');
    await queryRunner.query('ALTER TABLE recycled_item RENAME TO recycled_item_old');
    // don't use role and role_permission (admin)
    await queryRunner.query('DROP TABLE IF EXISTS role_permission');
    await queryRunner.query('ALTER TABLE tag RENAME TO tag_old');

    // ----- create new tables and insert data from old

    await queryRunner.query(`CREATE TABLE "member" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(), 
            "name" character varying(100) NOT NULL,
            "email" character varying(150) NOT NULL UNIQUE, 
            "extra" text NOT NULL DEFAULT '{}', 
            "type" character varying NOT NULL,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(), 
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(), 
            CONSTRAINT "PK_dcc0ff5b7c575e40d57b48e77b8" PRIMARY KEY ("id"))
            `);
    await queryRunner.query(
      'INSERT INTO "member" (id, type, email, name, extra, created_at, updated_at) SELECT id, type, email, name, extra, created_at, updated_at from member_old',
    );

    await queryRunner.query(`CREATE TABLE "item" (
                "id" uuid NOT NULL, 
                "name" character varying(500) NOT NULL,
                "type" character varying NOT NULL DEFAULT 'folder',
                "description" character varying(5000),
                "path" ltree NOT NULL UNIQUE, 
                "creator_id" uuid,
                "extra" text NOT NULL,
                "settings" text NOT NULL DEFAULT '{}',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(), 
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(), 
                "deleted_at" TIMESTAMP,
                CONSTRAINT "PK_ccc0ff5b7c575e40d57b48e77b8" PRIMARY KEY ("id"))
                `);
    await queryRunner.query(
      'INSERT INTO "item" (id, name, type, description, path, creator_id, extra, settings, created_at, updated_at) SELECT id, name, type, description, path, creator, extra, settings, created_at, updated_at from item_old',
    );
    await queryRunner.query(`UPDATE "item" as a1 SET deleted_at = (
                        SELECT created_at FROM recycled_item_old WHERE a1.path = recycled_item_old.item_path)`);

    await queryRunner.query(`CREATE TABLE "item_membership" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(), 
            "permission" character varying(100) NOT NULL,
            "item_path" ltree NOT NULL REFERENCES item("path") ON DELETE CASCADE ON UPDATE CASCADE,
            "creator_id" uuid REFERENCES member("id") ON DELETE CASCADE,
            "member_id" uuid REFERENCES member("id") ON DELETE CASCADE,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(), 
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_ccc0ff5b7c575e40d57b48e77a8" PRIMARY KEY ("member_id", "item_path")
            )`);
    await queryRunner.query(
      'ALTER TABLE "item_membership" ADD CONSTRAINT "item_membership-item-member" UNIQUE ("item_path", "member_id")',
    );
    await queryRunner.query(
      'INSERT INTO "item_membership" (item_path, member_id, creator_id, permission, created_at, updated_at) SELECT item_path, member_id, creator, permission, created_at, updated_at from item_membership_old',
    );

    // member password
    await queryRunner.query(
      'CREATE TABLE "member_password" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "password" character varying(100) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "member_id" uuid, CONSTRAINT "member-password" UNIQUE ("member_id"), CONSTRAINT "REL_81ea11a0e4f243edf76d53c284" UNIQUE ("member_id"), CONSTRAINT "PK_ff1a1183c81e78eaaa038f05a35" PRIMARY KEY ("id"))',
    );

    await queryRunner.query(
      'ALTER TABLE "member_password" ADD CONSTRAINT "FK_81ea11a0e4f243edf76d53c2843" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'INSERT INTO "member_password" (password, member_id) SELECT password, id FROM member_old where password IS NOT NULL',
    );

    // recycled item
    await queryRunner.query(
      'CREATE TABLE "recycled_item_data" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "creator_id" uuid NOT NULL, "item_path" ltree NOT NULL REFERENCES item("path") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "recycled-item-data" UNIQUE ("item_path"), CONSTRAINT "PK_d6f781e5054e98174c35c87c225" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'INSERT INTO "recycled_item_data" (creator_id, item_path, created_at) SELECT creator, item_path, created_at FROM recycled_item_old',
    );

    // item like
    await queryRunner.query(
      'CREATE TABLE "item_like" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "creator_id" uuid NOT NULL, "item_id" uuid NOT NULL REFERENCES item("id") ON DELETE CASCADE, CONSTRAINT "id" UNIQUE ("creator_id", "item_id"), CONSTRAINT "PK_3cca97fd246db52b4a34049b6a1" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'INSERT INTO "item_like" (creator_id, item_id, created_at) SELECT member_id, item_id, created_at FROM item_like_old',
    );

    // item login schema
    await queryRunner.query(
      'CREATE TABLE "item_login_schema" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying(100) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "item_path" ltree NOT NULL  REFERENCES item("path") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "item-login-schema" UNIQUE ("item_path"), CONSTRAINT "PK_ccc0ff5b7c575e40d57b48e77b7" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(`INSERT INTO "item_login_schema" (type, item_path) 
            SELECT (extra->>'itemLogin')::jsonb->>'loginSchema', path FROM item_old WHERE extra->>'itemLogin' IS NOT NULL`);

    //         // item login of members
    await queryRunner.query(
      'CREATE TABLE "item_login" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "password" character varying(100), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "member_id" uuid NOT NULL, "item_login_schema_id" uuid, CONSTRAINT "item-login-member" UNIQUE ("item_login_schema_id", "member_id"), CONSTRAINT "PK_5fa834add54f1c5262a1b012e50" PRIMARY KEY ("id"))',
    );
    // TODO
    await queryRunner.query(`INSERT INTO "item_login" (password, member_id, item_login_schema_id, created_at, updated_at) 
        SELECT (extra->>\'itemLogin\')::jsonb->>\'password\', m.id, ils.id, im.created_at , im.created_at 
        FROM member_old as m 
        INNER JOIN item_membership im ON im.member_id = m.id
        INNER JOIN item_login_schema ils ON ils.item_path = im.item_path 
        
        `);

    // TODO: action

    //         // item published
    await queryRunner.query(
      'CREATE TABLE "item_published" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "creator_id" uuid, "item_path" ltree NOT NULL  REFERENCES item("path") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "published-item" UNIQUE ("item_path"), CONSTRAINT "REL_490fddd9099ee7ddcccf8c776a" UNIQUE ("item_path"), CONSTRAINT "PK_3f196048ad22161a430250561f9" PRIMARY KEY ("id"))',
    );
    // TODO: production tag
    await queryRunner.query(
      'INSERT INTO "item_published" (creator_id, item_path, created_at) SELECT creator, item_path, created_at FROM item_tag_old WHERE id=\'ea9a3b4e-7b67-44c2-a9df-528b6ae5424f\'',
    );

    await queryRunner.query(`CREATE TABLE "item_flag" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            "type" character varying NOT NULL,
            "creator_id" uuid REFERENCES member("id") ON DELETE SET NULL,
            "item_id" uuid REFERENCES item("id") ON DELETE CASCADE,
            "created_at" TIMESTAMP NOT NULL DEFAULT now()
          )`);

    await queryRunner.query(
      'ALTER TABLE "item_flag" ADD CONSTRAINT "item-flag-creator" UNIQUE ("item_id", "type", "creator_id")',
    );
    await queryRunner.query(`INSERT INTO "item_flag" (type, creator_id, item_id, created_at) 
          SELECT f.name, if.creator, if.item_id, if.created_at FROM item_flag_old as if
          LEFT JOIN flag_old as f ON f.id=if.flag_id
          `);

    await queryRunner.query(`CREATE TABLE category (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            name VARCHAR(50)  NOT NULL,
            type character varying NOT NULL
        )`);
    await queryRunner.query(
      'ALTER TABLE "category" ADD CONSTRAINT "category-name-type" UNIQUE ("name", "type")',
    );
    await queryRunner.query(`INSERT INTO "category" (id, name, type) 
        SELECT c.id, c.name, ct.name FROM category_old as c
        LEFT JOIN category_type_old as ct ON c.type=ct.id
        `);

    await queryRunner.query(` CREATE TABLE item_category (
            id uuid DEFAULT uuid_generate_v4() NOT NULL,
            "creator_id" uuid REFERENCES member("id") ON DELETE SET NULL,
            item_path ltree REFERENCES item("path") ON DELETE CASCADE ON UPDATE CASCADE,
            category_id uuid REFERENCES category("id") ON DELETE CASCADE,
            "created_at" TIMESTAMP NOT NULL DEFAULT now()
        )`);
    await queryRunner.query(`INSERT INTO "item_category" (item_path, creator_id, category_id) 
        SELECT i.path, NULL, c.id FROM item_category_old as ic
        LEFT JOIN item_old as i ON i.id=ic.item_id
        LEFT JOIN category_old as c ON c.id=ic.category_id
        `);
    await queryRunner.query(
      'ALTER TABLE "item_category" ADD CONSTRAINT "category-item" UNIQUE ("category_id", "item_path")',
    );

    await queryRunner.query(`CREATE TABLE "chat_message" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,                
            "item_id" uuid REFERENCES "item" ("id") ON DELETE CASCADE,       
            "creator_id" uuid REFERENCES "member" ("id") ON DELETE SET NULL,   
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            "body" character varying(500) NOT NULL
        )`);
    await queryRunner.query(`INSERT INTO "chat_message" (item_id, creator_id, created_at, updated_at, body) 
            SELECT chat_id, creator, created_at, updated_at, body FROM chat_message_old 
            `);

    await queryRunner.query(
      'CREATE TYPE "public"."chat_mention_status_enum" AS ENUM(\'unread\', \'read\')',
    );
    await queryRunner.query(`CREATE TABLE "chat_mention"  (
                "id"         uuid UNIQUE    NOT NULL DEFAULT uuid_generate_v4(),
                "message_id" uuid REFERENCES "chat_message" ("id") ON DELETE CASCADE,     
                "member_id"  uuid REFERENCES "member" ("id") ON DELETE CASCADE,           
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "status" "public"."chat_mention_status_enum" NOT NULL DEFAULT 'unread',
                PRIMARY KEY ("id")
            )`);
    await queryRunner.query(`INSERT INTO "chat_mention" (message_id, member_id, created_at, updated_at, status) 
            SELECT message_id, member_id, created_at, updated_at, status::text::chat_mention_status_enum FROM chat_mention_old 
            `);

    await queryRunner.query(`CREATE TABLE "app_data" (
                "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
                "member_id" uuid REFERENCES "member" ("id") ON DELETE CASCADE NOT NULL,
                "item_id" uuid REFERENCES "item" ("id") ON DELETE CASCADE NOT NULL,
                "data" text NOT NULL DEFAULT '{}',
                "type" character varying(25) NOT NULL,
                "creator_id" uuid REFERENCES "member" ("id") ON DELETE SET NULL,
                "visibility" character varying NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now()
            )`);
    await queryRunner.query(`INSERT INTO "app_data" (item_id, creator_id, created_at, updated_at, member_id,type,visibility,data) 
                SELECT item_id, creator, created_at, updated_at, member_id,type,visibility,data FROM app_data_old 
                `);

    await queryRunner.query(`CREATE TABLE "app_action" (
                    "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
                    "member_id" uuid REFERENCES "member" ("id") ON DELETE CASCADE NOT NULL,
                    "item_id" uuid REFERENCES "item" ("id") ON DELETE CASCADE NOT NULL,
                    "data" text NOT NULL DEFAULT '{}',
                    "type" character varying(25)  NOT NULL,
                    "created_at" TIMESTAMP NOT NULL DEFAULT now()
                )`);
    await queryRunner.query(`INSERT INTO "app_action" (item_id,  created_at,  member_id,data) 
                    SELECT item_id, created_at,  member_id,data FROM app_action_old 
                    `);

    await queryRunner.query(
      `CREATE TABLE "app_setting" (
                "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
                "item_id" uuid REFERENCES "item" ("id") ON DELETE CASCADE NOT NULL,
                "creator_id" uuid REFERENCES "member" ("id") ON DELETE SET NULL ,
                "name" character varying NOT NULL,
                "data" text NOT NULL  DEFAULT '{}',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now()
            )`,
    );
    await queryRunner.query(`INSERT INTO "app_setting" (item_id, creator_id, created_at, updated_at,name,data) 
                        SELECT item_id, creator, created_at, updated_at, name,data FROM app_setting_old 
                        `);

    await queryRunner.query(`CREATE TABLE "invitation" (
            "id" uuid UNIQUE DEFAULT uuid_generate_v4() NOT NULL,
            "creator_id" uuid REFERENCES "member" ("id") ON DELETE SET NULL,
            "item_path" ltree REFERENCES "item" ("path") ON DELETE CASCADE ON UPDATE CASCADE,
            "name" character varying(100),
            "email" character varying(100) NOT NULL,
            "permission" character varying NOT NULL,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now()
        )`);
    await queryRunner.query(`INSERT INTO "invitation" (item_path, creator_id, created_at, updated_at,name,email,permission) 
            SELECT item_path, creator, created_at, updated_at,name,email,permission FROM invitation_old 
            `);

    await queryRunner.query(`CREATE TABLE "item_tag" (
          "id" uuid UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
          "type" character varying NOT NULL,
          "item_path" ltree REFERENCES "item" ("path") ON DELETE CASCADE ON UPDATE CASCADE,
          "creator_id" uuid REFERENCES "member" ("id") ON DELETE SET NULL, -- don't remove - set creator to NULL
          "created_at" TIMESTAMP NOT NULL DEFAULT now()
            )`);

    await queryRunner.query(
      'ALTER TABLE "item_tag" ADD CONSTRAINT "item-tag" UNIQUE ("item_path", "type")',
    );
    await queryRunner.query(`INSERT INTO "item_tag" (item_path, creator_id, created_at, type) 
                SELECT item_path, creator, it.created_at, t.name FROM item_tag_old as it 
                INNER JOIN tag_old as t ON t.id = it.tag_id 
                `);

    await queryRunner.query(`CREATE TABLE "publisher" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            "name" character varying(250) NOT NULL UNIQUE,
            "origins" text array  NOT NULL,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now()
        )`);
    await queryRunner.query(`INSERT INTO "publisher" (id, name, created_at,origins) 
            SELECT id, name, created_at,origins FROM publisher_old
            `);

    await queryRunner.query(`CREATE TABLE "app" (
                "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
                "key" uuid DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
            
                "name" character varying(250) NOT NULL,
                "description" character varying(250) NOT NULL,
            
                "url" character varying(250) NOT NULL UNIQUE,
                "publisher_id" uuid REFERENCES "publisher" ("id") ON DELETE CASCADE NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            
                "extra" text NOT NULL DEFAULT '{}'
            )`);
    await queryRunner.query(`INSERT INTO "app" (id, name, description,url,created_at,extra) 
                SELECT id, name, description,url,created_at,extra FROM app_old
                `);

    await queryRunner.query(`CREATE TABLE item_validation_group (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            item_id UUID NOT NULL REFERENCES item("id") ON DELETE CASCADE,
            "created_at" TIMESTAMP NOT NULL DEFAULT now()
            )`);
    await queryRunner.query(`INSERT INTO "item_validation_group" (id, item_id,created_at) 
                SELECT id, item_id,created_at FROM item_validation_old
                `);

    await queryRunner.query(`CREATE TABLE item_validation (
                    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
                    item_id uuid NOT NULL REFERENCES item("id") ON DELETE CASCADE,
                    process character varying NOT NULL,
                    status character varying NOT NULL,
                    result character varying,
                    item_validation_group_id uuid NOT NULL REFERENCES item_validation_group("id") ON DELETE CASCADE,
                    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                    "updated_at" TIMESTAMP NOT NULL DEFAULT now()
                    )`);
    await queryRunner.query(`INSERT INTO "item_validation" (id, item_id,process,status,created_at,updated_at,result, item_validation_group_id) 
                        SELECT ivg.id, ivg.item_id,p.name,ivgs.name,ivg.created_at,ivg.updated_at,result, iv.id 
                        FROM item_validation_group_old as ivg
                        LEFT JOIN item_validation_process_old as p ON p.id = ivg.item_validation_process_id 
                        LEFT JOIN item_validation_old as iv ON iv.id = ivg.item_validation_id 
                        LEFT JOIN item_validation_status_old as ivgs ON ivgs.id = ivg.status_id 
                        `);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS item_validation_review (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            item_validation_id UUID NOT NULL REFERENCES item_validation("id") ON DELETE CASCADE,
            reviewer_id UUID REFERENCES member("id") ON DELETE SET NULL,
            status character varying NOT NULL,
            reason character varying,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now()
            )`);
    await queryRunner.query(`INSERT INTO "item_validation_review" (id, item_validation_id, reviewer_id,status,created_at,updated_at, reason) 
                SELECT ivr.id, item_validation_id, reviewer_id,s.name,ivr.created_at,ivr.updated_at, reason 
                FROM item_validation_review_old as ivr
                LEFT JOIN item_validation_review_status_old as s on s.id= ivr.status_id
                LEFT JOIN item_validation_old as iv on iv.id= ivr.item_validation_id
                `);

    await queryRunner.query(
      'ALTER TABLE "chat_message" DROP CONSTRAINT IF EXISTS "chat_message_creator_id_fkey"',
    );
    await queryRunner.query(
      'ALTER TABLE "chat_message" DROP CONSTRAINT IF EXISTS "chat_message_item_id_fkey"',
    );
    await queryRunner.query(
      'ALTER TABLE "chat_mention" DROP CONSTRAINT IF EXISTS "chat_mention_member_id_fkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "chat_mention" DROP CONSTRAINT IF EXISTS "chat_mention_message_id_fkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" DROP CONSTRAINT IF EXISTS "invitation_item_path_fkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" DROP CONSTRAINT IF EXISTS "invitation_creator_id_fkey"',
    );
    await queryRunner.query(
      'ALTER TABLE "app_action" DROP CONSTRAINT IF EXISTS "app_action_item_id_fkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "app_action" DROP CONSTRAINT IF EXISTS "app_action_member_id_fkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "app_data" DROP CONSTRAINT IF EXISTS "app_data_creator_id_fkey"',
    );
    await queryRunner.query(
      'ALTER TABLE "app_data" DROP CONSTRAINT IF EXISTS "app_data_item_id_fkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "app_data" DROP CONSTRAINT IF EXISTS "app_data_member_id_fkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "app_setting" DROP CONSTRAINT IF EXISTS "app_setting_creator_id_fkey"',
    );
    await queryRunner.query(
      'ALTER TABLE "app_setting" DROP CONSTRAINT IF EXISTS "app_setting_item_id_fkey1"',
    );
    await queryRunner.query('ALTER TABLE "app" DROP CONSTRAINT IF EXISTS "app_publisher_id_fkey1"');
    await queryRunner.query(
      'ALTER TABLE "recycled_item_data" DROP CONSTRAINT IF EXISTS "recycled_item_data_item_path_fkey"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation_group" DROP CONSTRAINT IF EXISTS "item_validation_group_item_id_fkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation" DROP CONSTRAINT IF EXISTS "item_validation_item_validation_group_id_fkey"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation" DROP CONSTRAINT IF EXISTS "item_validation_item_id_fkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation_review" DROP CONSTRAINT IF EXISTS "item_validation_review_reviewer_id_fkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation_review" DROP CONSTRAINT IF EXISTS "item_validation_review_item_validation_id_fkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" DROP CONSTRAINT IF EXISTS "item_category_category_id_fkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" DROP CONSTRAINT IF EXISTS "item_category_item_path_fkey"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" DROP CONSTRAINT IF EXISTS "item_category_creator_id_fkey"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_flag" DROP CONSTRAINT IF EXISTS "item_flag_item_id_fkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_flag" DROP CONSTRAINT IF EXISTS "item_flag_creator_id_fkey"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_like" DROP CONSTRAINT IF EXISTS "item_like_item_id_fkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_login_schema" DROP CONSTRAINT IF EXISTS "item_login_schema_item_path_fkey"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" DROP CONSTRAINT IF EXISTS "item_membership_member_id_fkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" DROP CONSTRAINT IF EXISTS "item_membership_creator_id_fkey"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" DROP CONSTRAINT IF EXISTS "item_membership_item_path_fkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_tag" DROP CONSTRAINT IF EXISTS "item_tag_creator_id_fkey"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_tag" DROP CONSTRAINT IF EXISTS "item_tag_item_path_fkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_published" DROP CONSTRAINT IF EXISTS "item_published_item_path_fkey"',
    );
    await queryRunner.query('ALTER TABLE "member" ALTER COLUMN "type" SET DEFAULT \'individual\'');
    await queryRunner.query(
      'ALTER TABLE "invitation" DROP CONSTRAINT IF EXISTS "invitation_pkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" ADD CONSTRAINT "invitation_pkey1" PRIMARY KEY ("email", "item_path", "id")',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" DROP CONSTRAINT IF EXISTS "invitation_id_key1"',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" DROP CONSTRAINT IF EXISTS "invitation_pkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" ADD CONSTRAINT "invitation_pkey1" PRIMARY KEY ("item_path", "id")',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" DROP CONSTRAINT IF EXISTS "invitation_pkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" ADD CONSTRAINT "PK_beb994737756c0f18a1c1f8669c" PRIMARY KEY ("id")',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" DROP CONSTRAINT IF EXISTS "category-item"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" DROP CONSTRAINT IF EXISTS "item_category_pkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" ADD CONSTRAINT "item_category_pkey1" PRIMARY KEY ("item_path", "category_id", "id")',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" DROP CONSTRAINT IF EXISTS "item_category_pkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" ADD CONSTRAINT "item_category_pkey1" PRIMARY KEY ("item_path", "id")',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" DROP CONSTRAINT IF EXISTS "item_category_pkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" ADD CONSTRAINT "PK_91ba90f150e8804bdaad7b17ff8" PRIMARY KEY ("id")',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" DROP CONSTRAINT IF EXISTS "item_membership-item-member"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" DROP CONSTRAINT IF EXISTS "PK_ccc0ff5b7c575e40d57b48e77a8"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" ADD CONSTRAINT "PK_ccc0ff5b7c575e40d57b48e77a8" PRIMARY KEY ("member_id", "item_path", "id")',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" DROP CONSTRAINT IF EXISTS "PK_ccc0ff5b7c575e40d57b48e77a8"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" ADD CONSTRAINT "PK_fbfb92f094949a9071156e16906" PRIMARY KEY ("id", "item_path")',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" DROP CONSTRAINT IF EXISTS "PK_fbfb92f094949a9071156e16906"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" ADD CONSTRAINT "PK_4697b5e1247909f5c884cc12ec3" PRIMARY KEY ("id")',
    );
    await queryRunner.query('ALTER TABLE "item_tag" DROP CONSTRAINT IF EXISTS "item-tag"');
    await queryRunner.query('ALTER TABLE "item_tag" DROP CONSTRAINT IF EXISTS "item_tag_pkey1"');
    await queryRunner.query(
      'ALTER TABLE "item_tag" ADD CONSTRAINT "item_tag_pkey1" PRIMARY KEY ("item_path", "type", "id")',
    );
    await queryRunner.query('ALTER TABLE "item_tag" DROP CONSTRAINT IF EXISTS "item_tag_id_key1"');
    await queryRunner.query('ALTER TABLE "item_tag" DROP CONSTRAINT IF EXISTS "item_tag_pkey1"');
    await queryRunner.query(
      'ALTER TABLE "item_tag" ADD CONSTRAINT "item_tag_pkey1" PRIMARY KEY ("item_path", "id")',
    );
    await queryRunner.query('ALTER TABLE "item_tag" DROP CONSTRAINT IF EXISTS "item_tag_pkey1"');
    await queryRunner.query(
      'ALTER TABLE "item_tag" ADD CONSTRAINT "PK_5cff999fc1b42609c37d868dc8a" PRIMARY KEY ("id")',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" ADD CONSTRAINT "item-email" UNIQUE ("item_path", "email")',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" ADD CONSTRAINT "category-item" UNIQUE ("category_id", "item_path")',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" ADD CONSTRAINT "item_membership-item-member" UNIQUE ("item_path", "member_id")',
    );
    await queryRunner.query(
      'ALTER TABLE "item_tag" ADD CONSTRAINT "item-tag" UNIQUE ("item_path", "type")',
    );
    await queryRunner.query(
      'ALTER TABLE "item" ADD CONSTRAINT "FK_bdc46717fadc2f04f3093e51fd5" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "chat_message" ADD CONSTRAINT "FK_b31e627ea7a4787672e265a1579" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "chat_message" ADD CONSTRAINT "FK_71fdcb9038eca1b903102bdfd17" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "chat_mention" ADD CONSTRAINT "FK_e5199951167b722215127651e7c" FOREIGN KEY ("message_id") REFERENCES "chat_message"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "chat_mention" ADD CONSTRAINT "FK_f22de4941ca58910967a5626755" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" ADD CONSTRAINT "FK_7ad4a490d5b9f79a677827b641c" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" ADD CONSTRAINT "FK_dc1d92accde1c2fbb7e729e4dcc" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE "app_action" ADD CONSTRAINT "FK_c415fc186dda51fa260d338d776" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "app_action" ADD CONSTRAINT "FK_7750f85aef0f67acdbcb904395a" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "app_data" ADD CONSTRAINT "FK_8c3e2463c67d9865658941c9e2d" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "app_data" ADD CONSTRAINT "FK_27cb180cb3f372e4cf55302644a" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "app_data" ADD CONSTRAINT "FK_b8c8a36a32850e3096451a8b727" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "app_setting" ADD CONSTRAINT "FK_f5922b885e2680beab8add96008" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "app_setting" ADD CONSTRAINT "FK_22d3d051ee6f94932c1373a3d09" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "app" ADD CONSTRAINT "FK_37eb7baab82e11150157ec0b5a6" FOREIGN KEY ("publisher_id") REFERENCES "publisher"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "recycled_item_data" ADD CONSTRAINT "FK_3e3650ebd5c49843013429d510a" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "recycled_item_data" ADD CONSTRAINT "FK_f8a4db4476e3d81e18de5d63c42" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation_group" ADD CONSTRAINT "FK_a9e83cf5f53c026b774b53d3c60" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation" ADD CONSTRAINT "FK_d60969d5e478e7c844532ac4e7f" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation" ADD CONSTRAINT "FK_e92da280941f666acf87baedc65" FOREIGN KEY ("item_validation_group_id") REFERENCES "item_validation_group"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation_review" ADD CONSTRAINT "FK_59fd000835c70c728e525d82950" FOREIGN KEY ("item_validation_id") REFERENCES "item_validation"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation_review" ADD CONSTRAINT "FK_44bf14fee580ae08702d70e622e" FOREIGN KEY ("reviewer_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" ADD CONSTRAINT "FK_638552fc7d9a2035c2b53182d8a" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" ADD CONSTRAINT "FK_9a34a079b5b24f4396462546d26" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" ADD CONSTRAINT "FK_5681d1785eea699e9cae8818fe0" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE "item_flag" ADD CONSTRAINT "FK_b04d0adf4b73d82537c92fa55ea" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_flag" ADD CONSTRAINT "FK_bde9b9ab1da1483a71c9b916dd2" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_like" ADD CONSTRAINT "FK_4a56eba1ce30dc93f118a51ff26" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_like" ADD CONSTRAINT "FK_159827eb667d019dc71372d7463" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_login_schema" ADD CONSTRAINT "FK_b4a263d8c8392a73e0a1febf7d3" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE "item_login" ADD CONSTRAINT "FK_342f83bdd41dbd854c1328cd684" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_login" ADD CONSTRAINT "FK_d2a1fec675a75e8ae1b2a73b0c0" FOREIGN KEY ("item_login_schema_id") REFERENCES "item_login_schema"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" ADD CONSTRAINT "FK_25b6506de99e92886ed97174ab8" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" ADD CONSTRAINT "FK_da1b92e08975efd46df22512884" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" ADD CONSTRAINT "FK_d935785e7ecc015ed3ca048ff05" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE "item_tag" ADD CONSTRAINT "FK_354758ae1c8199f9b4a66ffb6a3" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_tag" ADD CONSTRAINT "FK_9efd997d733334e84e22410592c" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE "item_published" ADD CONSTRAINT "FK_bfeeeb8d1257029e4d7f7ec1375" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_published" ADD CONSTRAINT "FK_490fddd9099ee7ddcccf8c776a1" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE',
    );

    await queryRunner.query('DROP TABLE action_old');
    await queryRunner.query('DROP TABLE action_request_export_old');
    await queryRunner.query('DROP TABLE IF EXISTS admin_role_old');
    await queryRunner.query('DROP TABLE app_old');
    await queryRunner.query('DROP TABLE app_data_old');
    await queryRunner.query('DROP TABLE app_action_old');
    await queryRunner.query('DROP TABLE app_setting_old');
    await queryRunner.query('DROP TABLE chat_mention_old');
    await queryRunner.query('DROP TABLE chat_message_old');
    await queryRunner.query('DROP TABLE invitation_old');
    await queryRunner.query('DROP TABLE item_category_old');
    await queryRunner.query('DROP TABLE item_flag_old');
    await queryRunner.query('DROP TABLE flag_old');
    await queryRunner.query('DROP TABLE item_like_old');
    await queryRunner.query('DROP TABLE item_member_login_old');
    await queryRunner.query('DROP TABLE item_membership_old');
    await queryRunner.query('DROP TABLE item_tag_old');
    await queryRunner.query('DROP TABLE category_old');
    await queryRunner.query('DROP TABLE category_type_old');
    await queryRunner.query('DROP TABLE item_validation_group_old');
    await queryRunner.query('DROP TABLE item_validation_review_old');
    await queryRunner.query('DROP TABLE item_validation_process_old');
    await queryRunner.query('DROP TABLE item_validation_status_old');
    await queryRunner.query('DROP TABLE item_validation_review_status_old');
    await queryRunner.query('DROP TABLE item_validation_old');
    await queryRunner.query('DROP TABLE IF EXISTS permission_old');
    await queryRunner.query('DROP TABLE publisher_old');
    await queryRunner.query('DROP TABLE recycled_item_old');
    await queryRunner.query('DROP TABLE IF EXISTS role_permission_old');
    await queryRunner.query('DROP TABLE tag_old');
    await queryRunner.query('DROP TABLE item_old');
    await queryRunner.query('DROP TABLE member_old');

    await queryRunner.query('DROP TYPE IF EXISTS "permissions_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS mention_status');
    await queryRunner.query('DROP TYPE IF EXISTS "app_data_visibility_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "nested_tag_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "member_type_enum"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "item_published" DROP CONSTRAINT IF EXISTS "FK_490fddd9099ee7ddcccf8c776a1"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_published" DROP CONSTRAINT IF EXISTS "FK_bfeeeb8d1257029e4d7f7ec1375"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_tag" DROP CONSTRAINT IF EXISTS "FK_9efd997d733334e84e22410592c"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_tag" DROP CONSTRAINT IF EXISTS "FK_354758ae1c8199f9b4a66ffb6a3"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" DROP CONSTRAINT IF EXISTS "FK_d935785e7ecc015ed3ca048ff05"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" DROP CONSTRAINT IF EXISTS "FK_da1b92e08975efd46df22512884"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" DROP CONSTRAINT IF EXISTS "FK_25b6506de99e92886ed97174ab8"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_login" DROP CONSTRAINT IF EXISTS "FK_d2a1fec675a75e8ae1b2a73b0c0"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_login" DROP CONSTRAINT IF EXISTS "FK_342f83bdd41dbd854c1328cd684"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_login_schema" DROP CONSTRAINT IF EXISTS "FK_b4a263d8c8392a73e0a1febf7d3"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_like" DROP CONSTRAINT IF EXISTS "FK_159827eb667d019dc71372d7463"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_like" DROP CONSTRAINT IF EXISTS "FK_4a56eba1ce30dc93f118a51ff26"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_flag" DROP CONSTRAINT IF EXISTS "FK_bde9b9ab1da1483a71c9b916dd2"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_flag" DROP CONSTRAINT IF EXISTS "FK_b04d0adf4b73d82537c92fa55ea"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" DROP CONSTRAINT IF EXISTS "FK_5681d1785eea699e9cae8818fe0"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" DROP CONSTRAINT IF EXISTS "FK_9a34a079b5b24f4396462546d26"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" DROP CONSTRAINT IF EXISTS "FK_638552fc7d9a2035c2b53182d8a"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation_review" DROP CONSTRAINT IF EXISTS "FK_44bf14fee580ae08702d70e622e"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation_review" DROP CONSTRAINT IF EXISTS "FK_59fd000835c70c728e525d82950"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation" DROP CONSTRAINT IF EXISTS "FK_e92da280941f666acf87baedc65"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation" DROP CONSTRAINT IF EXISTS "FK_d60969d5e478e7c844532ac4e7f"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation_group" DROP CONSTRAINT IF EXISTS "FK_a9e83cf5f53c026b774b53d3c60"',
    );
    await queryRunner.query(
      'ALTER TABLE "recycled_item_data" DROP CONSTRAINT IF EXISTS "FK_f8a4db4476e3d81e18de5d63c42"',
    );
    await queryRunner.query(
      'ALTER TABLE "recycled_item_data" DROP CONSTRAINT IF EXISTS "FK_3e3650ebd5c49843013429d510a"',
    );
    await queryRunner.query(
      'ALTER TABLE "app" DROP CONSTRAINT IF EXISTS "FK_37eb7baab82e11150157ec0b5a6"',
    );
    await queryRunner.query(
      'ALTER TABLE "app_setting" DROP CONSTRAINT IF EXISTS "FK_22d3d051ee6f94932c1373a3d09"',
    );
    await queryRunner.query(
      'ALTER TABLE "app_setting" DROP CONSTRAINT IF EXISTS "FK_f5922b885e2680beab8add96008"',
    );
    await queryRunner.query(
      'ALTER TABLE "app_data" DROP CONSTRAINT IF EXISTS "FK_b8c8a36a32850e3096451a8b727"',
    );
    await queryRunner.query(
      'ALTER TABLE "app_data" DROP CONSTRAINT IF EXISTS "FK_27cb180cb3f372e4cf55302644a"',
    );
    await queryRunner.query(
      'ALTER TABLE "app_data" DROP CONSTRAINT IF EXISTS "FK_8c3e2463c67d9865658941c9e2d"',
    );
    await queryRunner.query(
      'ALTER TABLE "app_action" DROP CONSTRAINT IF EXISTS "FK_7750f85aef0f67acdbcb904395a"',
    );
    await queryRunner.query(
      'ALTER TABLE "app_action" DROP CONSTRAINT IF EXISTS "FK_c415fc186dda51fa260d338d776"',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" DROP CONSTRAINT IF EXISTS "FK_dc1d92accde1c2fbb7e729e4dcc"',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" DROP CONSTRAINT IF EXISTS "FK_7ad4a490d5b9f79a677827b641c"',
    );
    await queryRunner.query(
      'ALTER TABLE "chat_mention" DROP CONSTRAINT IF EXISTS "FK_f22de4941ca58910967a5626755"',
    );
    await queryRunner.query(
      'ALTER TABLE "chat_mention" DROP CONSTRAINT IF EXISTS "FK_e5199951167b722215127651e7c"',
    );
    await queryRunner.query(
      'ALTER TABLE "chat_message" DROP CONSTRAINT IF EXISTS "FK_71fdcb9038eca1b903102bdfd17"',
    );
    await queryRunner.query(
      'ALTER TABLE "chat_message" DROP CONSTRAINT IF EXISTS "FK_b31e627ea7a4787672e265a1579"',
    );
    await queryRunner.query(
      'ALTER TABLE "item" DROP CONSTRAINT IF EXISTS "FK_bdc46717fadc2f04f3093e51fd5"',
    );
    await queryRunner.query('ALTER TABLE "item_tag" DROP CONSTRAINT IF EXISTS "item-tag"');
    await queryRunner.query(
      'ALTER TABLE "item_membership" DROP CONSTRAINT IF EXISTS "item_membership-item-member"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" DROP CONSTRAINT IF EXISTS "category-item"',
    );
    await queryRunner.query('ALTER TABLE "invitation" DROP CONSTRAINT IF EXISTS "item-email"');
    await queryRunner.query(
      'ALTER TABLE "item_tag" DROP CONSTRAINT IF EXISTS "PK_5cff999fc1b42609c37d868dc8a"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_tag" ADD CONSTRAINT "item_tag_pkey1" PRIMARY KEY ("item_path", "id")',
    );
    await queryRunner.query('ALTER TABLE "item_tag" DROP CONSTRAINT IF EXISTS "item_tag_pkey1"');
    await queryRunner.query(
      'ALTER TABLE "item_tag" ADD CONSTRAINT "item_tag_pkey1" PRIMARY KEY ("item_path", "id", "type")',
    );
    await queryRunner.query(
      'ALTER TABLE "item_tag" ADD CONSTRAINT "item_tag_id_key1" UNIQUE ("id")',
    );
    await queryRunner.query('ALTER TABLE "item_tag" DROP CONSTRAINT IF EXISTS "item_tag_pkey1"');
    await queryRunner.query(
      'ALTER TABLE "item_tag" ADD CONSTRAINT "item_tag_pkey1" PRIMARY KEY ("item_path", "type")',
    );
    await queryRunner.query(
      'ALTER TABLE "item_tag" ADD CONSTRAINT "item-tag" UNIQUE ("type", "item_path")',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" DROP CONSTRAINT IF EXISTS "PK_4697b5e1247909f5c884cc12ec3"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" ADD CONSTRAINT "PK_fbfb92f094949a9071156e16906" PRIMARY KEY ("id", "item_path")',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" DROP CONSTRAINT IF EXISTS "PK_fbfb92f094949a9071156e16906"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" ADD CONSTRAINT "PK_ccc0ff5b7c575e40d57b48e77a8" PRIMARY KEY ("member_id", "id", "item_path")',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" DROP CONSTRAINT IF EXISTS "PK_ccc0ff5b7c575e40d57b48e77a8"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" ADD CONSTRAINT "PK_ccc0ff5b7c575e40d57b48e77a8" PRIMARY KEY ("member_id", "item_path")',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" ADD CONSTRAINT "item_membership-item-member" UNIQUE ("item_path", "member_id")',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" DROP CONSTRAINT IF EXISTS "PK_91ba90f150e8804bdaad7b17ff8"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" ADD CONSTRAINT "item_category_pkey1" PRIMARY KEY ("item_path", "id")',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" DROP CONSTRAINT IF EXISTS "item_category_pkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" ADD CONSTRAINT "item_category_pkey1" PRIMARY KEY ("item_path", "category_id", "id")',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" DROP CONSTRAINT IF EXISTS "item_category_pkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" ADD CONSTRAINT "item_category_pkey1" PRIMARY KEY ("item_path", "category_id")',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" ADD CONSTRAINT "category-item" UNIQUE ("item_path", "category_id")',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" DROP CONSTRAINT IF EXISTS "PK_beb994737756c0f18a1c1f8669c"',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" ADD CONSTRAINT "invitation_pkey1" PRIMARY KEY ("item_path", "id")',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" DROP CONSTRAINT IF EXISTS "invitation_pkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" ADD CONSTRAINT "invitation_pkey1" PRIMARY KEY ("email", "item_path", "id")',
    );
    await queryRunner.query('ALTER TABLE "invitation" ALTER COLUMN "name" SET DEFAULT NULL');
    await queryRunner.query(
      'ALTER TABLE "invitation" ADD CONSTRAINT "invitation_id_key1" UNIQUE ("id")',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" DROP CONSTRAINT IF EXISTS "invitation_pkey1"',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" ADD CONSTRAINT "invitation_pkey1" PRIMARY KEY ("email", "item_path")',
    );
    await queryRunner.query('ALTER TABLE "member" ALTER COLUMN "type" DROP DEFAULT');
    await queryRunner.query(
      'ALTER TABLE "item_published" ADD CONSTRAINT "item_published_item_path_fkey" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE "item_tag" ADD CONSTRAINT "item_tag_item_path_fkey1" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE "item_tag" ADD CONSTRAINT "item_tag_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" ADD CONSTRAINT "item_membership_item_path_fkey1" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" ADD CONSTRAINT "item_membership_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_membership" ADD CONSTRAINT "item_membership_member_id_fkey1" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_login_schema" ADD CONSTRAINT "item_login_schema_item_path_fkey" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE "item_like" ADD CONSTRAINT "item_like_item_id_fkey1" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_flag" ADD CONSTRAINT "item_flag_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_flag" ADD CONSTRAINT "item_flag_item_id_fkey1" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" ADD CONSTRAINT "item_category_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" ADD CONSTRAINT "item_category_item_path_fkey" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE "item_category" ADD CONSTRAINT "item_category_category_id_fkey1" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation_review" ADD CONSTRAINT "item_validation_review_item_validation_id_fkey1" FOREIGN KEY ("item_validation_id") REFERENCES "item_validation"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation_review" ADD CONSTRAINT "item_validation_review_reviewer_id_fkey1" FOREIGN KEY ("reviewer_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation" ADD CONSTRAINT "item_validation_item_id_fkey1" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation" ADD CONSTRAINT "item_validation_item_validation_group_id_fkey" FOREIGN KEY ("item_validation_group_id") REFERENCES "item_validation_group"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_validation_group" ADD CONSTRAINT "item_validation_group_item_id_fkey1" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "recycled_item_data" ADD CONSTRAINT "recycled_item_data_item_path_fkey" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE "app" ADD CONSTRAINT "app_publisher_id_fkey1" FOREIGN KEY ("publisher_id") REFERENCES "publisher"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "app_setting" ADD CONSTRAINT "app_setting_item_id_fkey1" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "app_setting" ADD CONSTRAINT "app_setting_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "app_data" ADD CONSTRAINT "app_data_member_id_fkey1" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "app_data" ADD CONSTRAINT "app_data_item_id_fkey1" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "app_data" ADD CONSTRAINT "app_data_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "app_action" ADD CONSTRAINT "app_action_member_id_fkey1" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "app_action" ADD CONSTRAINT "app_action_item_id_fkey1" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" ADD CONSTRAINT "invitation_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "invitation" ADD CONSTRAINT "invitation_item_path_fkey1" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE "chat_mention" ADD CONSTRAINT "chat_mention_message_id_fkey1" FOREIGN KEY ("message_id") REFERENCES "chat_message"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "chat_mention" ADD CONSTRAINT "chat_mention_member_id_fkey1" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );

    await queryRunner.query("CREATE TYPE \"member_type_enum\" AS ENUM ('individual', 'group')");
    await queryRunner.query("CREATE TYPE \"permissions_enum\" AS ENUM ('read', 'write', 'admin')");

    await queryRunner.query("CREATE TYPE \"nested_tag_enum\" AS ENUM ('allow', 'fail')");
    await queryRunner.query("CREATE TYPE mention_status AS ENUM ('unread', 'read')");
    await queryRunner.query(
      "CREATE TYPE \"app_data_visibility_enum\" AS ENUM ('member', 'item'); --, 'app', 'publisher')",
    );

    // -- CREATE everything
    await queryRunner.query(`CREATE TABLE "member_old" (
          "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
          "name" character varying(300) NOT NULL,
          "email" character varying(150) UNIQUE NOT NULL,
          "password" character(60) DEFAULT NULL,
          "type" member_type_enum DEFAULT 'individual' NOT NULL,
          "extra" jsonb NOT NULL DEFAULT \'{}\'::jsonb,
        
          "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE \'utc\'),
          "updated_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE \'utc\'))`);
    await queryRunner.query(
      'INSERT INTO "member_old" (id, type, email, name, extra, created_at, updated_at) SELECT id, type::member_type_enum, email, name, extra::jsonb, created_at, updated_at from member',
    );
    await queryRunner.query(
      'UPDATE "member_old" set password = (SELECT password FROM member_password where member_id = member_old.id)',
    );

    await queryRunner.query(`CREATE TABLE "item_old" (
            "id" uuid PRIMARY KEY, -- generated programatically and passed on insertion
            "name" character varying(500) NOT NULL,
            "description" character varying(5000),
            "type" character varying(100),
            "path" ltree UNIQUE NOT NULL,
            "extra" jsonb NOT NULL DEFAULT \'{}\'::jsonb,
            "settings" jsonb NOT NULL DEFAULT \'{}\'::jsonb,
          
            "creator" uuid REFERENCES "member_old" ("id") ON DELETE SET NULL, 
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE \'utc\'),
            "updated_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE \'utc\')
            )`);
    await queryRunner.query(
      'INSERT INTO "item_old" (id, name, type, description, path, creator, extra, settings, created_at, updated_at) SELECT id, name, type, description, path, creator_id, extra::jsonb, settings::jsonb, created_at, updated_at from item',
    );

    await queryRunner.query(`CREATE TABLE "item_membership_old" (
          "id" uuid UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
          -- delete row if member is deleted
          "member_id" uuid REFERENCES "member_old" ("id") ON DELETE CASCADE,
          -- delete row if item is deleted; update path if item\'s path is updated.
          "item_path" ltree REFERENCES "item_old" ("path") ON DELETE CASCADE ON UPDATE CASCADE,
          "permission" permissions_enum NOT NULL,
          "creator" uuid REFERENCES "member_old" ("id") ON DELETE SET NULL, -- don"t remove - set creator to NULL
        
          "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE \'utc\'),
          "updated_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE \'utc\'),
            PRIMARY KEY ("member_id", "item_path")
            )`);

    await queryRunner.query(
      'INSERT INTO "item_membership_old" (item_path, member_id, creator, permission, created_at, updated_at) SELECT item_path, member_id, creator_id, permission::permissions_enum, created_at, updated_at from item_membership',
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

    await queryRunner.query(`CREATE TABLE "action_old" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            "member_id" uuid REFERENCES "member_old" ("id") ON DELETE SET NULL,
            "item_id" uuid REFERENCES "item_old" ("id") ON DELETE SET NULL,
            "member_type" character varying(100),
            "item_type" character varying(100),
            "action_type" character varying(100),
            "view" character varying(100),
            "geolocation" jsonb DEFAULT '{}'::jsonb,
            "extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
        )`);
    // TODO

    await queryRunner.query(`CREATE TABLE "action_request_export_old" (
          "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
          "member_id" uuid REFERENCES "member_old" ("id") ON DELETE CASCADE,
          item_path ltree REFERENCES "item_old" ("path") ON DELETE SET NULL ON UPDATE CASCADE,
          "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
            )`);
    // TODO

    await queryRunner.query(`CREATE TABLE "invitation_old" (
            "id" uuid UNIQUE DEFAULT uuid_generate_v4(),
            "creator" uuid REFERENCES "member_old" ("id") ON DELETE CASCADE,
            "item_path" ltree REFERENCES "item_old" ("path") ON DELETE CASCADE ON UPDATE CASCADE,
            "name" character varying(100) DEFAULT NULL,
            "email" character varying(100) NOT NULL,
            "permission" permissions_enum NOT NULL,
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            "updated_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            PRIMARY KEY ("item_path","email")
        )`);
    await queryRunner.query(`INSERT INTO "invitation_old" (item_path, creator, created_at, updated_at,name,email,permission) 
            SELECT item_path, creator_id, created_at, updated_at,name,email,permission::permissions_enum FROM invitation 
            `);

    await queryRunner.query(` CREATE TABLE "recycled_item_old" (
            "id" uuid PRIMARY KEY UNIQUE NOT NULL DEFAULT uuid_generate_v4(), -- generated programatically and passed on insertion
            "item_id" uuid UNIQUE NOT NULL REFERENCES "item_old" ("id") ON DELETE CASCADE,
            "item_path" ltree UNIQUE NOT NULL REFERENCES "item_old" ("path") ON DELETE CASCADE ON UPDATE CASCADE,
            "creator" uuid REFERENCES "member_old" ("id") ON DELETE SET NULL, -- don't remove item - set creator to NULL
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
            )`);
    await queryRunner.query(
      'INSERT INTO "recycled_item_old" (creator, item_path, created_at) SELECT creator_id, item_path, created_at FROM recycled_item_data',
    );

    await queryRunner.query(`CREATE TABLE "tag_old" (
          "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
          -- 'name' might not be the final label for the user but a (recognizable) short english label that behaves as a key for translation
          "name" character varying(100) NOT NULL,
          -- "creator" uuid REFERENCES "member_old" ("id") ON DELETE SET NULL, -- don't remove - set creator to NULL
          "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
            )`);
    await queryRunner.query(`INSERT INTO "tag_old" (name) 
            SELECT DISTINCT type FROM item_tag 
            `);

    await queryRunner.query(`CREATE TABLE "item_tag_old" (
          "id" uuid UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
          -- delete row if tag is deleted
          "tag_id" uuid REFERENCES "tag_old" ("id") ON DELETE CASCADE,
          -- delete row if item is deleted; update path if item's path is updated.
          "item_path" ltree REFERENCES "item_old" ("path") ON DELETE CASCADE ON UPDATE CASCADE,
          "creator" uuid REFERENCES "member_old" ("id") ON DELETE SET NULL, -- don't remove - set creator to NULL
        
          "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
          PRIMARY KEY ("tag_id", "item_path")
            )`);
    await queryRunner.query(`INSERT INTO "item_tag_old" (tag_id, item_path, creator, created_at) 
                    SELECT t.id, item_path, creator_id, it.created_at FROM item_tag as it 
                    INNER JOIN tag_old as t ON t.name = it.type 
                    `);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS category_type_old (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            name VARCHAR(20)
            )`);
    await queryRunner.query(`INSERT INTO "category_type_old" (name) 
            SELECT DISTINCT  c.type FROM category as c
            `);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS category_old (
            id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            name VARCHAR(50),
            type uuid,
            FOREIGN KEY (type) REFERENCES category_type_old("id") ON DELETE CASCADE
        )`);
    await queryRunner.query(`INSERT INTO "category_old" (name, type) 
        SELECT DISTINCT  c.name, t.id FROM category as c
        INNER JOIN category_type_old as t ON c.name = t.name 
        `);

    // -- CREATE item_category table
    await queryRunner.query(` CREATE TABLE item_category_old (
            id uuid DEFAULT uuid_generate_v4(),
            item_id uuid,
            category_id uuid,
            PRIMARY KEY(item_id, category_id),
            FOREIGN KEY(item_id) REFERENCES item_old(id) ON DELETE CASCADE,
            FOREIGN KEY(category_id) REFERENCES category_old(id) ON DELETE CASCADE
        )`);
    await queryRunner.query(`INSERT INTO "item_category_old" (item_id, category_id) 
        SELECT i.id, ic.category_id FROM item_category as ic
        INNER JOIN item as i  ON i.path = ic.item_path 
        `);

    // -- create table for different validation processes
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS item_validation_process_old (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            description VARCHAR(500),
            name VARCHAR(100) NOT NULL,
            enabled BOOLEAN NOT NULL
            )`);
    await queryRunner.query(`INSERT INTO "item_validation_process_old" ( name, enabled) 
            SELECT DISTINCT process, true FROM item_validation 
            `);

    // -- create tables for validation and review statuses
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS item_validation_status_old (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            name VARCHAR(50) NOT NULL
            )`);
    await queryRunner.query(`INSERT INTO "item_validation_status_old" ( name) 
            SELECT DISTINCT status FROM item_validation 
            `);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS item_validation_review_status_old (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            name VARCHAR(50) NOT NULL
            )`);
    await queryRunner.query(`INSERT INTO "item_validation_review_status_old" ( name) 
            SELECT DISTINCT status FROM item_validation_review 
            `);

    // -- create table for automatic validation records
    // -- one record for each validation attempt
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS item_validation_old (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            item_id UUID NOT NULL REFERENCES item_old("id") ON DELETE CASCADE,
            created_at timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
            )`);
    await queryRunner.query(`INSERT INTO "item_validation_old" (id, item_id,created_at) 
                    SELECT id, item_id,created_at FROM item_validation_group
                    `);

    // -- one record for each process
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS item_validation_group_old (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            item_id UUID NOT NULL REFERENCES item_old("id") ON DELETE CASCADE,
            item_validation_id UUID NOT NULL REFERENCES item_validation_old("id") ON DELETE CASCADE,
            item_validation_process_id UUID NOT NULL REFERENCES item_validation_process_old("id") ON DELETE CASCADE,
            status_id UUID NOT NULL REFERENCES item_validation_status_old("id") ON DELETE CASCADE,
            result VARCHAR(50),
            updated_at timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            created_at timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
            )`);
    await queryRunner.query(`INSERT INTO "item_validation_group_old" (id, item_id,item_validation_process_id,status_id,created_at,updated_at,result, item_validation_id) 
                            SELECT iv.id, iv.item_id,p.id,ivgs.id,iv.created_at,iv.updated_at,result, ivg.id 
                            FROM item_validation as iv
                            LEFT JOIN item_validation_process_old as p ON p.name = iv.process 
                            LEFT JOIN item_validation_group as ivg ON ivg.id = iv.item_validation_group_id 
                            LEFT JOIN item_validation_status_old as ivgs ON ivgs.name = iv.status 
                            `);

    // -- create table for manual validation records
    // -- one record for each validation process that needs manual review
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS item_validation_review_old (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            item_validation_id UUID NOT NULL REFERENCES item_validation_old("id") ON DELETE CASCADE,
            reviewer_id UUID REFERENCES member_old("id") ON DELETE CASCADE,
            status_id UUID NOT NULL REFERENCES item_validation_review_status_old("id") ON DELETE CASCADE,
            reason VARCHAR(100),
            updated_at timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            created_at timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
            )`);
    await queryRunner.query(`INSERT INTO "item_validation_review_old" (id, item_validation_id, reviewer_id,status_id,created_at,updated_at, reason) 
                    SELECT ivr.id, item_validation_id, reviewer_id,s.id,ivr.created_at,ivr.updated_at, reason 
                    FROM item_validation_review as ivr
                    LEFT JOIN item_validation_review_status_old as s on s.name= ivr.status
                    LEFT JOIN item_validation as iv on iv.id= ivr.item_validation_id
                    `);

    await queryRunner.query(`CREATE TABLE "item_member_login_old" (
            "item_id" uuid REFERENCES "item_old" ("id") ON DELETE CASCADE,
            "member_id" uuid REFERENCES "member_old" ("id") ON DELETE CASCADE,
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            PRIMARY KEY ("item_id", "member_id")
            )`);
    // TODO

    await queryRunner.query(`CREATE TABLE "chat_message_old" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,                
            "chat_id" uuid REFERENCES "item_old" ("id") ON DELETE CASCADE,       
            "creator" uuid REFERENCES "member_old" ("id") ON DELETE SET NULL,   
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'), 
            updated_at timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            "body" character varying(500)
        )`);
    await queryRunner.query(`INSERT INTO "chat_message_old" (chat_id, creator, created_at, updated_at, body) 
            SELECT item_id, creator_id, created_at, updated_at, body FROM chat_message 
            `);

    await queryRunner.query(`CREATE TABLE "chat_mention_old" 
            (
                "id"         uuid UNIQUE    NOT NULL DEFAULT uuid_generate_v4(),
                "item_path"  ltree REFERENCES "item_old" ("path") ON DELETE CASCADE,          -- delete row if item is deleted
                "message_id" uuid REFERENCES "chat_message_old" ("id") ON DELETE CASCADE,      -- delete row if member is deleted
                "member_id"  uuid REFERENCES "member_old" ("id") ON DELETE CASCADE,            -- delete row if member is deleted
                "creator"    uuid           REFERENCES "member_old" ("id") ON DELETE SET NULL, -- don't remove - set creator to NULL
                "created_at" timestamp      NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
                "updated_at" timestamp      NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
                "status"     mention_status NOT NULL DEFAULT 'unread',
                PRIMARY KEY ("id")
            )`);

    await queryRunner.query(`INSERT INTO "chat_mention_old" (item_path, message_id, member_id, creator, created_at, updated_at, status) 
            SELECT i.path, message_id, member_id, m.creator_id, cm.created_at, cm.updated_at, status::text::mention_status FROM chat_mention as cm
            LEFT JOIN chat_message as m on m.id = cm.message_id
            LEFT JOIN item as i on i.id = m.item_id
            `);

    await queryRunner.query(`CREATE TABLE "flag_old" (
                "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
                "name" character varying(100) NOT NULL
              )`);
    await queryRunner.query(`INSERT INTO "flag_old" (name) 
              SELECT DISTINCT type FROM item_flag
              `);

    await queryRunner.query(`CREATE TABLE "item_flag_old" (
                "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
                "flag_id" uuid REFERENCES "flag_old" ("id") ON DELETE CASCADE,
                "item_id" uuid REFERENCES "item_old" ("id") ON DELETE CASCADE,
                "creator" uuid REFERENCES "member_old" ("id") ON DELETE SET NULL,
                "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
              )`);
    await queryRunner.query(`INSERT INTO "item_flag_old" (flag_id, creator, item_id, created_at) 
          SELECT f.id, if.creator_id, if.item_id, if.created_at FROM item_flag as if
          LEFT JOIN flag_old as f ON f.name=if.type
          `);

    await queryRunner.query(`CREATE TABLE "publisher_old" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            "name" character varying(250) NOT NULL,
            "origins" character varying(100)[],
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
        )`);
    await queryRunner.query(`INSERT INTO "publisher_old" (id, name, created_at,origins) 
            SELECT id, name, created_at,origins FROM publisher
            `);

    await queryRunner.query(`CREATE TABLE "app_old" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        
            "name" character varying(250) NOT NULL,
            "description" character varying(250) NOT NULL,
        
            "url" character varying(250) NOT NULL,
            "publisher_id" uuid REFERENCES "publisher_old" ("id") ON DELETE CASCADE NOT NULL,
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
        
            "extra" jsonb NOT NULL DEFAULT '{}'::jsonb
        )`);
    await queryRunner.query(`INSERT INTO "app_old" (id, name, description,url,created_at,extra) 
                SELECT id, name, description,url,created_at,extra::jsonb FROM app
                `);

    await queryRunner.query(`CREATE TABLE "app_data_old" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        
            -- delete row if member is deleted
            "member_id" uuid REFERENCES "member_old" ("id") ON DELETE CASCADE NOT NULL,
            -- "session_id" character varying(25), -- TODO: maybe necessary for "public use".
        
            -- delete row if item is deleted
            "item_id" uuid REFERENCES "item_old" ("id") ON DELETE CASCADE NOT NULL,
        
            "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
            "type" character varying(25),
        
            -- don't remove - set creator to NULL
            "creator" uuid REFERENCES "member_old" ("id") ON DELETE SET NULL,
        
            -- "ownership" app_data_ownership_enum DEFAULT 'member' NOT NULL,
            "visibility" app_data_visibility_enum DEFAULT 'member' NOT NULL,
        
            -- TODO: I think this is to discard; maybe item should keep a reference to the appId in its settings?
            -- "app_id" uuid REFERENCES "app_old" ("id"), -- must be set if ownership != ('member' or 'item')
            -- "publisher_id" uuid REFERENCES "publisher_old" ("id"), -- must be set if ownership != ('member' or 'item')
        
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            "updated_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
        )`);
    await queryRunner.query(`INSERT INTO "app_data_old" (item_id, creator, created_at, updated_at, member_id,type,visibility,data) 
                SELECT item_id, creator_id, created_at, updated_at, member_id,type,visibility::text::app_data_visibility_enum,data::jsonb FROM app_data
                `);

    await queryRunner.query(`CREATE TABLE "app_action_old" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            "member_id" uuid REFERENCES "member_old" ("id") ON DELETE CASCADE NOT NULL,
            "item_id" uuid REFERENCES "item_old" ("id") ON DELETE CASCADE NOT NULL,
            "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
            "type" character varying(25),
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
        )`);
    await queryRunner.query(`INSERT INTO "app_action_old" (item_id,  created_at,  member_id,data) 
                    SELECT item_id, created_at,  member_id,data::jsonb FROM app_action 
                    `);

    await queryRunner.query(`CREATE TABLE "app_setting_old" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        
            -- delete row if item is deleted
            "item_id" uuid REFERENCES "item_old" ("id") ON DELETE CASCADE NOT NULL,
        
            "name" character varying(250) NOT NULL,
        
            "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
        
            -- don't remove - set creator to NULL
            "creator" uuid REFERENCES "member_old" ("id") ON DELETE SET NULL,
        
            "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
            "updated_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
        )`);
    await queryRunner.query(`INSERT INTO "app_setting_old" (item_id,    creator, created_at, updated_at,name,data) 
                        SELECT item_id, creator_id, created_at, updated_at, name,data::jsonb FROM app_setting
                        `);

    await queryRunner.query(`CREATE TABLE item_like_old (
            id uuid DEFAULT uuid_generate_v4(),
            item_id uuid NOT NULL REFERENCES item_old("id") ON DELETE CASCADE,
                member_id uuid NOT NULL REFERENCES member_old("id") ON DELETE CASCADE,
                created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
                PRIMARY KEY (item_id, member_id)
                )`);

    await queryRunner.query(
      'INSERT INTO "item_like_old" (member_id, item_id, created_at) SELECT creator_id, item_id, created_at FROM item_like',
    );

    await queryRunner.query(`CREATE TABLE "action" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            "member_id" uuid REFERENCES "member_old" ("id") ON DELETE SET NULL,
            "item_id" uuid REFERENCES "item_old" ("id") ON DELETE SET NULL,
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
          "member_id" uuid REFERENCES "member_old" ("id") ON DELETE CASCADE,
          "item_id" uuid REFERENCES "item_old" ("id") ON DELETE CASCADE,
          "created_at" timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
            )`);

    await queryRunner.query(`ALTER TABLE action
            ADD item_path ltree REFERENCES "item_old" ("path") ON DELETE SET NULL ON UPDATE CASCADE`);

    await queryRunner.query(`UPDATE action as a1 SET item_path = 
            (SELECT path FROM item WHERE a1.item_id = item.id)`);
    // TODO

    // drop new table
    await queryRunner.query('DROP TABLE action');
    await queryRunner.query('DROP TABLE action_request_export');
    await queryRunner.query('DROP TABLE app');
    await queryRunner.query('DROP TABLE app_action');
    await queryRunner.query('DROP TABLE app_data');
    await queryRunner.query('DROP TABLE app_setting');
    await queryRunner.query('DROP TABLE publisher');
    await queryRunner.query('DROP TABLE item_category');
    await queryRunner.query('DROP TABLE category');
    await queryRunner.query('DROP TABLE chat_mention');
    await queryRunner.query('DROP TABLE chat_message');
    await queryRunner.query('DROP TABLE invitation');
    await queryRunner.query('DROP TABLE item_flag');
    await queryRunner.query('DROP TABLE item_like');
    await queryRunner.query('DROP TABLE item_login');
    await queryRunner.query('DROP TABLE item_login_schema');
    await queryRunner.query('DROP TABLE item_membership');
    await queryRunner.query('DROP TABLE item_published');
    await queryRunner.query('DROP TABLE item_tag');
    await queryRunner.query('DROP TABLE item_validation_review');
    await queryRunner.query('DROP TABLE item_validation');
    await queryRunner.query('DROP TABLE item_validation_group');
    await queryRunner.query('DROP TABLE member_password');
    await queryRunner.query('DROP TABLE recycled_item_data');
    await queryRunner.query('DROP TABLE item');
    await queryRunner.query('DROP TABLE member');

    // rename all tables to old
    await queryRunner.query('ALTER TABLE action_old RENAME TO action');
    await queryRunner.query(
      'ALTER TABLE action_request_export_old RENAME TO action_request_export',
    );

    await queryRunner.query('ALTER TABLE app_old RENAME TO app');
    await queryRunner.query('ALTER TABLE app_data_old RENAME TO app_data');
    await queryRunner.query('ALTER TABLE app_action_old RENAME TO app_action');
    await queryRunner.query('ALTER TABLE app_setting_old RENAME TO app_setting');
    await queryRunner.query('ALTER TABLE category_old RENAME TO category');
    await queryRunner.query('ALTER TABLE category_type_old RENAME TO category_type');
    await queryRunner.query('ALTER TABLE chat_mention_old RENAME TO chat_mention');
    await queryRunner.query('ALTER TABLE chat_message_old RENAME TO chat_message');
    await queryRunner.query('ALTER TABLE flag_old RENAME TO flag');
    await queryRunner.query('ALTER TABLE invitation_old RENAME TO invitation');
    await queryRunner.query('ALTER TABLE item_old RENAME TO item');
    await queryRunner.query('ALTER TABLE item_category_old RENAME TO item_category');
    await queryRunner.query('ALTER TABLE item_flag_old RENAME TO item_flag');
    await queryRunner.query('ALTER TABLE item_like_old RENAME TO item_like');
    await queryRunner.query('ALTER TABLE item_member_login_old RENAME TO item_member_login');
    await queryRunner.query('ALTER TABLE item_membership_old RENAME TO item_membership');
    await queryRunner.query('ALTER TABLE item_tag_old RENAME TO item_tag');
    await queryRunner.query('ALTER TABLE item_validation_old RENAME TO item_validation');
    await queryRunner.query(
      'ALTER TABLE item_validation_group_old RENAME TO item_validation_group',
    );
    await queryRunner.query(
      'ALTER TABLE item_validation_review_old RENAME TO item_validation_review',
    );
    await queryRunner.query(
      'ALTER TABLE item_validation_process_old RENAME TO item_validation_process',
    );
    await queryRunner.query(
      'ALTER TABLE item_validation_status_old RENAME TO item_validation_status',
    );
    await queryRunner.query(
      'ALTER TABLE item_validation_review_status_old RENAME TO item_validation_review_status',
    );
    await queryRunner.query('ALTER TABLE member_old RENAME TO member');

    await queryRunner.query('ALTER TABLE publisher_old RENAME TO publisher');
    await queryRunner.query('ALTER TABLE recycled_item_old RENAME TO recycled_item');

    await queryRunner.query('DROP TABLE IF EXISTS role_permission');
    await queryRunner.query('ALTER TABLE tag_old RENAME TO tag');
    await queryRunner.query('DROP TYPE "public"."chat_mention_status_enum"');
  }
}
