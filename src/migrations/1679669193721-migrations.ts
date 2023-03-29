import { MigrationInterface, QueryRunner } from 'typeorm';

export class migrations1679669193721 implements MigrationInterface {
    name = 'migrations1679669193721';

    public async up(queryRunner: QueryRunner): Promise<void> {

        // move all tables to old
        await queryRunner.query('RENAME TABLE action TO action_old');
        await queryRunner.query('RENAME TABLE action_request_export TO action_request_export_old');
        // don't use we never used admin_role anymore
        await queryRunner.query('RENAME TABLE app TO app_old');
        await queryRunner.query('RENAME TABLE app_data TO app_data_old');
        await queryRunner.query('RENAME TABLE app_action TO app_action_old');
        await queryRunner.query('RENAME TABLE app_setting TO app_setting_old');
        await queryRunner.query('RENAME TABLE category TO category_old');
        // don't use category_types anymore
        await queryRunner.query('RENAME TABLE chat_mention TO chat_mention_old');
        await queryRunner.query('RENAME TABLE chat_message TO chat_message_old');
        await queryRunner.query('RENAME TABLE flag TO flag_old');
        await queryRunner.query('RENAME TABLE invitation TO invitation_old');
        await queryRunner.query('RENAME TABLE item TO item_old');
        await queryRunner.query('RENAME TABLE item_category TO item_category_old');
        await queryRunner.query('RENAME TABLE item_flag TO item_flag_old');
        await queryRunner.query('RENAME TABLE item_like TO item_like_old');
        await queryRunner.query('RENAME TABLE item_member_login TO item_member_login_old');
        await queryRunner.query('RENAME TABLE item_membership TO item_membership_old');
        await queryRunner.query('RENAME TABLE item_tag TO item_tag_old');
        await queryRunner.query('RENAME TABLE item_validation TO item_validation_old');
        await queryRunner.query('RENAME TABLE item_validation_group TO item_validation_group_old');
        await queryRunner.query('RENAME TABLE item_validation_review TO item_validation_review_old');
        await queryRunner.query('RENAME TABLE item_validation_process TO item_validation_process_old');
        // don't use item_validation_review_status 
        // don't use item_validation_status anymore
        await queryRunner.query('RENAME TABLE member TO member_old');
        // don't use permission (admin?)
        await queryRunner.query('RENAME TABLE publisher TO publisher_old');
        await queryRunner.query('RENAME TABLE recycled_item TO recycled_item_old');
        // don't use role and role_permission (admin)
        await queryRunner.query('RENAME TABLE tag TO tag_old');
 
        // ----- create new tables and insert data from old
        
        // member password
        await queryRunner.query('CREATE TABLE "member_password" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "password" character varying(100) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "member_id" uuid, CONSTRAINT "member-password" UNIQUE ("member_id"), CONSTRAINT "REL_81ea11a0e4f243edf76d53c284" UNIQUE ("member_id"), CONSTRAINT "PK_ff1a1183c81e78eaaa038f05a35" PRIMARY KEY ("id"))');
        await queryRunner.query('INSERT INTO "member_password" (password, member_id) SELECT password, id FROM member_old');

        // recycled item
        await queryRunner.query('CREATE TABLE "recycled_item_data" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "creator_id" uuid NOT NULL, "item_path" ltree NOT NULL, CONSTRAINT "recycled-item-data" UNIQUE ("item_path"), CONSTRAINT "PK_d6f781e5054e98174c35c87c225" PRIMARY KEY ("id"))');
        await queryRunner.query('INSERT INTO "recycled_item_data" (creator_id, item_path, created_at) SELECT creator, item_path, created_at FROM recycled_item_old');

        // item like
        await queryRunner.query('CREATE TABLE "item_like" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "creator_id" uuid NOT NULL, "item_id" uuid NOT NULL, CONSTRAINT "id" UNIQUE ("creator_id", "item_id"), CONSTRAINT "PK_3cca97fd246db52b4a34049b6a1" PRIMARY KEY ("id"))');
        await queryRunner.query('INSERT INTO "item_like" (creator_id, item_id, created_at) SELECT creator, item_path, created_at FROM item_like_old');

        // item login schema
        // await queryRunner.query('CREATE TABLE "item_login_schema" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying(100) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "item_path" ltree NOT NULL, CONSTRAINT "item-login-schema" UNIQUE ("item_path"), CONSTRAINT "PK_ccc0ff5b7c575e40d57b48e77b7" PRIMARY KEY ("id"))');
        // // TODO
        // // await queryRunner.query('INSERT INTO "item_login_schema" (type, item_path) SELECT extra->>itemLogin->>loginSchema, path FROM item WHERE extra->>itemLogin NOT NULL');

//         // item login of members
//         await queryRunner.query('CREATE TABLE "item_login" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "password" character varying(100), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "member_id" uuid NOT NULL, "item_login_schema_id" uuid, CONSTRAINT "item-login-member" UNIQUE ("item_login_schema_id", "member_id"), CONSTRAINT "PK_5fa834add54f1c5262a1b012e50" PRIMARY KEY ("id"))');
// // TODO
// await queryRunner.query('INSERT INTO "item_login" (password, member_id, item_login_schema_id) SELECT creator, item_path, created_at FROM recycled_item');

//         // item published
        await queryRunner.query('CREATE TABLE "item_published" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "creator_id" uuid, "item_path" ltree NOT NULL, CONSTRAINT "published-item" UNIQUE ("item_path"), CONSTRAINT "REL_490fddd9099ee7ddcccf8c776a" UNIQUE ("item_path"), CONSTRAINT "PK_3f196048ad22161a430250561f9" PRIMARY KEY ("id"))');
        // TODO: production tag
        await queryRunner.query('INSERT INTO "item_published" (creator_id, item_path, created_at) SELECT creator, item_path, created_at FROM item_tag WHERE id="ea9a3b4e-7b67-44c2-a9df-528b6ae5424f"');


//         // item flag
//         await queryRunner.query('ALTER TABLE "item_flag" ADD "creator_id" uuid');
//         await queryRunner.query('UPDATE "item_flag" SET creator_id = creator');
//         await queryRunner.query('ALTER TABLE "item_flag" DROP COLUMN "creator"');
        
//         await queryRunner.query('ALTER TABLE "item_flag" ADD "type" character varying');
//         await queryRunner.query('UPDATE "item_flag" as a1 SET type = (SELECT name FROM flag WHERE id = a1.flag_id)');
//         await queryRunner.query('ALTER TABLE "item_flag" ALTER COLUMN "type" SET NOT NULL');
//         await queryRunner.query('ALTER TABLE "item_flag" DROP COLUMN "flag_id"');



//         // member type
//         await queryRunner.query('ALTER TABLE "member" RENAME COLUMN "type" TO "type_old"');
//         await queryRunner.query('ALTER TABLE "member" ADD "type" character varying NOT NULL DEFAULT \'individual\'');
//         await queryRunner.query('UPDATE "member" SET type = type_old');
//         await queryRunner.query('ALTER TABLE "member" DROP COLUMN "type_old"');
//         await queryRunner.query('DROP TYPE "public"."member_type_enum"');

//         // member extra
//         await queryRunner.query('ALTER TABLE "member" RENAME COLUMN "extra" TO "extra_old"');
//         await queryRunner.query('ALTER TABLE "member" ADD "extra" text NOT NULL DEFAULT \'{}\'');
//         await queryRunner.query('UPDATE "member" SET extra = extra_old');
//         await queryRunner.query('ALTER TABLE "member" DROP COLUMN "extra_old"');

//         // membership permission
//         await queryRunner.query('ALTER TABLE "item_membership" RENAME COLUMN "permission" TO "permission_old"');
//         await queryRunner.query('ALTER TABLE "item_membership" ADD "permission" character varying(100)');
//         await queryRunner.query('UPDATE "item_membership" SET permission = permission_old');
//         await queryRunner.query('ALTER TABLE "item_membership" DROP COLUMN "permission_old"');
//         await queryRunner.query('ALTER TABLE "item_membership" ALTER COLUMN "permission" SET NOT NULL');


//         // move item category id to path
//         await queryRunner.query('ALTER TABLE "item_category" ADD "item_path" ltree');
//         await queryRunner.query('ALTER TABLE "item_category" ADD CONSTRAINT "FK_b31e627ea7a4787672e225a1579" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE');
//         await queryRunner.query('UPDATE "item_category" as a1 SET item_path = (SELECT path FROM item WHERE a1.item_id = item.id)');
//         await queryRunner.query('ALTER TABLE "item_category" ALTER COLUMN "item_path" SET NOT NULL');

//         // item category creator
//         await queryRunner.query('ALTER TABLE "item_category" ADD "creator_id" uuid');
//         await queryRunner.query('UPDATE "item_category" SET creator_id = creator');

//         // // change member name column
//         // await queryRunner.query('ALTER TABLE "member" RENAME COLUMN "name" TO "name_old"');
//         // await queryRunner.query('ALTER TABLE "member" ADD "name" character varying(100)');
//         // await queryRunner.query('UPDATE "member" SET name = name_old');
//         // await queryRunner.query('ALTER TABLE "member" DROP COLUMN "name_old"');
//         // await queryRunner.query('ALTER TABLE "member" ALTER COLUMN "name" SET NOT NULL');

//         // item extra
//         await queryRunner.query('ALTER TABLE "item" RENAME COLUMN "extra" TO "extra_old"');
//         await queryRunner.query('ALTER TABLE "item" ADD "extra" text');
//         await queryRunner.query('UPDATE "item" SET extra = extra_old');
//         await queryRunner.query('ALTER TABLE "item" ALTER COLUMN "extra" SET NOT NULL');
//         await queryRunner.query('ALTER TABLE "item" DROP COLUMN "extra_old"');

//         // item deleted_at
//         await queryRunner.query('ALTER TABLE "item" ADD "deleted_at" TIMESTAMP');
//         await queryRunner.query('UPDATE "item" as a1 SET deleted_at = (SELECT created_at FROM recycled_item WHERE a1.path = recycled_item.item_path)');
       
//         // item creator id
//         await queryRunner.query('ALTER TABLE "item" ADD "creator_id" uuid');
//         await queryRunner.query('UPDATE "item" SET creator_id = creator');
        
//         // item type
//         await queryRunner.query('ALTER TABLE "item" RENAME COLUMN "type" TO "type_old"');
//         await queryRunner.query('ALTER TABLE "item" ADD "type" character varying NOT NULL DEFAULT \'folder\'');
//         await queryRunner.query('UPDATE "item" SET type = type_old');
//         await queryRunner.query('ALTER TABLE "item" DROP COLUMN "type_old"');

//         // item settings
//         await queryRunner.query('ALTER TABLE "item" RENAME COLUMN "settings" TO "settings_old"');
//         await queryRunner.query('ALTER TABLE "item" ADD "settings" text NOT NULL DEFAULT \'{}\'');
//         await queryRunner.query('UPDATE "item" SET settings = settings_old');
//         await queryRunner.query('ALTER TABLE "item" DROP COLUMN "settings_old"');

//         // chat message item id
//         await queryRunner.query('ALTER TABLE "chat_message" ADD "item_id" uuid');
//         await queryRunner.query('UPDATE "chat_message" SET item_id = chat_id');
        
//         // chat message member id
//         await queryRunner.query('ALTER TABLE "chat_message" ADD "member_id" uuid');
//         await queryRunner.query('UPDATE "chat_message" SET member_id = creator');
       
//         // app data creator id
//         await queryRunner.query('ALTER TABLE "app_data" ADD "creator_id" uuid');
//         await queryRunner.query('UPDATE "app_data" SET creator_id = creator');
       
//         // app setting creator id
//         await queryRunner.query('ALTER TABLE "app_setting" ADD "creator_id" uuid');
//         await queryRunner.query('UPDATE "app_setting" SET creator_id = creator');

//         // invitation permission
//         await queryRunner.query('ALTER TABLE "invitation" RENAME COLUMN "permission" TO "permission_old"');
//         await queryRunner.query('ALTER TABLE "invitation" ADD "permission" character varying');
//         await queryRunner.query('UPDATE "invitation" SET permission = permission_old');
//         await queryRunner.query('ALTER TABLE "invitation" ALTER COLUMN "permission" SET NOT NULL');
//         await queryRunner.query('ALTER TABLE "invitation" DROP COLUMN "permission_old"');

//         // invitation creator id
//         await queryRunner.query('ALTER TABLE "invitation" ADD "creator_id" uuid');
//         await queryRunner.query('UPDATE "invitation" SET creator_id = creator');


//         // invitation path
//         await queryRunner.query('ALTER TABLE "invitation" DROP CONSTRAINT "invitation_item_path_fkey"');
//         await queryRunner.query('ALTER TABLE "invitation" RENAME COLUMN "item_path" TO "item_path_old"');
//         await queryRunner.query('ALTER TABLE "invitation" ADD "item_path" ltree');
//         await queryRunner.query('UPDATE "invitation" SET item_path = item_path_old');
//         await queryRunner.query('ALTER TABLE "invitation" ALTER COLUMN "item_path" SET NOT NULL');
//         await queryRunner.query('ALTER TABLE "invitation" DROP COLUMN "item_path_old"');

//         // move item tag id to type
//         // TODO: update strings
//         await queryRunner.query('ALTER TABLE "item_tag" ADD "type" character varying');
//         await queryRunner.query('UPDATE "item_tag" as a1 SET type = (SELECT name FROM tag WHERE a1.tag_id = tag.id)');
//         await queryRunner.query('ALTER TABLE "item_tag" ALTER COLUMN "type" SET NOT NULL');

//         // app data type
//         await queryRunner.query('ALTER TABLE "app_data" RENAME COLUMN "type" TO "type_old"');
//         await queryRunner.query('ALTER TABLE "app_data" ADD "type" character varying(25)');
//         await queryRunner.query('UPDATE "app_data" SET type = type_old');
//         await queryRunner.query('ALTER TABLE "app_data" DROP COLUMN "type_old"');
//         await queryRunner.query('ALTER TABLE "app_data" ALTER COLUMN "type" SET NOT NULL');

//         // app data visibility
//         await queryRunner.query('ALTER TABLE "app_data" RENAME COLUMN "visibility" TO "visibility_old"');
//         await queryRunner.query('ALTER TABLE "app_data" ADD "visibility" character varying ');
//         await queryRunner.query('UPDATE "app_data" SET visibility = visibility_old');
//         await queryRunner.query('ALTER TABLE "app_data" DROP COLUMN "visibility_old"');
//         await queryRunner.query('ALTER TABLE "app_data" ALTER COLUMN "type" SET NOT NULL');

//         await queryRunner.query('DROP TYPE "public"."app_data_visibility_enum"');

//         // publisher origins
//         await queryRunner.query('ALTER TABLE "publisher" RENAME COLUMN "origins" TO "origins_old"');
//         await queryRunner.query('ALTER TABLE "publisher" ADD "origins" text array');
//         await queryRunner.query('UPDATE "publisher" SET origins = origins_old');
//         await queryRunner.query('ALTER TABLE "publisher" DROP COLUMN "origins_old"');
//         await queryRunner.query('ALTER TABLE "publisher" ALTER COLUMN "origins" SET NOT NULL');

//         // app data data
//         await queryRunner.query('ALTER TABLE "app_data" RENAME COLUMN "data" TO "data_old"');
//         await queryRunner.query('ALTER TABLE "app_data" ADD "data" text DEFAULT \'{}\'');
//         await queryRunner.query('UPDATE "app_data" SET data = data_old');
//         await queryRunner.query('ALTER TABLE "app_data" DROP COLUMN "data_old"');
//         await queryRunner.query('ALTER TABLE "app_data" ALTER COLUMN "data" SET NOT NULL');

//         // app setting name
//         await queryRunner.query('ALTER TABLE "app_setting" RENAME COLUMN "name" TO "name_old"');
//         await queryRunner.query('ALTER TABLE "app_setting" ADD "name" character varying');
//         await queryRunner.query('UPDATE "app_setting" SET name = name_old');
//         await queryRunner.query('ALTER TABLE "app_setting" DROP COLUMN "name_old"');
//         await queryRunner.query('ALTER TABLE "app_setting" ALTER COLUMN "name" SET NOT NULL');
        
//         // app setting data
//         await queryRunner.query('ALTER TABLE "app_setting" RENAME COLUMN "data" TO "data_old"');
//         await queryRunner.query('ALTER TABLE "app_setting" ADD "data" text NOT NULL DEFAULT \'{}\'');
//         await queryRunner.query('UPDATE "app_setting" SET data = data_old');
//         await queryRunner.query('ALTER TABLE "app_setting" DROP COLUMN "data_old"');
//         await queryRunner.query('ALTER TABLE "app_setting" ALTER COLUMN "data" SET NOT NULL');

//         // app extra
//         await queryRunner.query('ALTER TABLE "app" RENAME COLUMN "extra" TO "extra_old"');
//         await queryRunner.query('ALTER TABLE "app" ADD "extra" text DEFAULT \'{}\'');
//         await queryRunner.query('UPDATE "app" SET extra = extra_old');
//         await queryRunner.query('ALTER TABLE "app" DROP COLUMN "extra_old"');
//         await queryRunner.query('ALTER TABLE "app" ALTER COLUMN "extra" SET NOT NULL');

//         // category name
//         await queryRunner.query('ALTER TABLE "category" RENAME COLUMN "name" TO "name_old"');
//         await queryRunner.query('ALTER TABLE "category" ADD "name" character varying(50)');
//         await queryRunner.query('UPDATE "category" SET name = name_old');
//         await queryRunner.query('ALTER TABLE "category" DROP COLUMN "name_old"');
//         await queryRunner.query('ALTER TABLE "category" ALTER COLUMN "name" SET NOT NULL');

//         // category type
//         await queryRunner.query('ALTER TABLE "category" RENAME COLUMN "type" TO "type_old"');
//         await queryRunner.query('ALTER TABLE "category" ADD "type" character varying');
//         await queryRunner.query('UPDATE "category" SET type = (SELECT name FROM category_type WHERE a1.type = category_type.id)');
//         await queryRunner.query('ALTER TABLE "category" DROP COLUMN "type_old"');
//         await queryRunner.query('ALTER TABLE "category" ALTER COLUMN "type" SET NOT NULL');

//         // unused tables
//         await queryRunner.query('DROP TABLE flag');
//         await queryRunner.query('DROP TABLE category_type');
//         await queryRunner.query('DROP TABLE member_role');
//         await queryRunner.query('DROP TABLE item_validation_process');
//         await queryRunner.query('DROP TABLE item_validation_status');
//         await queryRunner.query('DROP TABLE item_validation_review_status');


//         await queryRunner.query('ALTER TABLE "item" DROP CONSTRAINT "item_creator_fkey"');
//         await queryRunner.query('ALTER TABLE "chat_message" DROP CONSTRAINT "chat_message_chat_id_fkey"');
//         await queryRunner.query('ALTER TABLE "chat_message" DROP CONSTRAINT "chat_message_creator_fkey"');
//         await queryRunner.query('ALTER TABLE "chat_mention" DROP CONSTRAINT "chat_mention_item_path_fkey"');
//         await queryRunner.query('ALTER TABLE "chat_mention" DROP CONSTRAINT "chat_mention_message_id_fkey"');
//         await queryRunner.query('ALTER TABLE "chat_mention" DROP CONSTRAINT "chat_mention_member_id_fkey"');
//         await queryRunner.query('ALTER TABLE "chat_mention" DROP CONSTRAINT "chat_mention_creator_fkey"');
//         await queryRunner.query('ALTER TABLE "invitation" DROP CONSTRAINT "invitation_creator_fkey"');
//         await queryRunner.query('ALTER TABLE "app_action" DROP CONSTRAINT "app_action_member_id_fkey"');
//         await queryRunner.query('ALTER TABLE "app_action" DROP CONSTRAINT "app_action_item_id_fkey"');
//         await queryRunner.query('ALTER TABLE "app_data" DROP CONSTRAINT "app_data_member_id_fkey"');
//         await queryRunner.query('ALTER TABLE "app_data" DROP CONSTRAINT "app_data_item_id_fkey"');
//         await queryRunner.query('ALTER TABLE "app_data" DROP CONSTRAINT "app_data_creator_fkey"');
//         await queryRunner.query('ALTER TABLE "app_setting" DROP CONSTRAINT "app_setting_item_id_fkey"');
//         await queryRunner.query('ALTER TABLE "app_setting" DROP CONSTRAINT "app_setting_creator_fkey"');
//         await queryRunner.query('ALTER TABLE "app" DROP CONSTRAINT "app_publisher_id_fkey"');
//         await queryRunner.query('ALTER TABLE "item_validation_group" DROP CONSTRAINT "item_validation_group_item_id_fkey"');
//         await queryRunner.query('ALTER TABLE "item_validation_group" DROP CONSTRAINT "item_validation_group_item_validation_id_fkey"');
//         await queryRunner.query('ALTER TABLE "item_validation_group" DROP CONSTRAINT "item_validation_group_item_validation_process_id_fkey"');
//         await queryRunner.query('ALTER TABLE "item_validation_group" DROP CONSTRAINT "item_validation_group_status_id_fkey"');
//         await queryRunner.query('ALTER TABLE "item_validation" DROP CONSTRAINT "item_validation_item_id_fkey"');
//         await queryRunner.query('ALTER TABLE "item_validation_review" DROP CONSTRAINT "item_validation_review_item_validation_id_fkey"');
//         await queryRunner.query('ALTER TABLE "item_validation_review" DROP CONSTRAINT "item_validation_review_reviewer_id_fkey"');
//         await queryRunner.query('ALTER TABLE "item_validation_review" DROP CONSTRAINT "item_validation_review_status_id_fkey"');
//         await queryRunner.query('ALTER TABLE "item_category" DROP CONSTRAINT "item_category_item_id_fkey"');
//         await queryRunner.query('ALTER TABLE "item_category" DROP CONSTRAINT "item_category_category_id_fkey"');
//         await queryRunner.query('ALTER TABLE "item_flag" DROP CONSTRAINT "item_flag_flag_id_fkey"');
//         await queryRunner.query('ALTER TABLE "item_flag" DROP CONSTRAINT "item_flag_item_id_fkey"');
//         await queryRunner.query('ALTER TABLE "item_flag" DROP CONSTRAINT "item_flag_creator_fkey"');
//         await queryRunner.query('ALTER TABLE "item_membership" DROP CONSTRAINT "item_membership_member_id_fkey"');
//         await queryRunner.query('ALTER TABLE "item_membership" DROP CONSTRAINT "item_membership_item_path_fkey"');
//         await queryRunner.query('ALTER TABLE "item_membership" DROP CONSTRAINT "item_membership_creator_fkey"');
//         await queryRunner.query('ALTER TABLE "item_tag" DROP CONSTRAINT "item_tag_tag_id_fkey"');
//         await queryRunner.query('ALTER TABLE "item_tag" DROP CONSTRAINT "item_tag_item_path_fkey"');
//         await queryRunner.query('ALTER TABLE "item_tag" DROP CONSTRAINT "item_tag_creator_fkey"');
//         await queryRunner.query('DROP INDEX "public"."item_path_idx"');
//         await queryRunner.query('DROP INDEX "public"."item_creator_idx"');
//         await queryRunner.query('DROP INDEX "public"."chat_message_chat_id_idx"');
//         await queryRunner.query('DROP INDEX "public"."chat_message_id_chat_id_idx"');
//         await queryRunner.query('DROP INDEX "public"."chat_message_created_at_idx"');
//         await queryRunner.query('DROP INDEX "public"."chat_mention_member_id_idx"');
//         await queryRunner.query('DROP INDEX "public"."app_action_item_id_idx"');
//         await queryRunner.query('DROP INDEX "public"."app_data_item_id_idx"');
//         await queryRunner.query('DROP INDEX "public"."app_setting_item_id_idx"');
//         await queryRunner.query('DROP INDEX "public"."item_membership_item_path_idx"');
//         await queryRunner.query('DROP INDEX "public"."item_tag_item_path_idx"');
        
//         await queryRunner.query('ALTER TABLE "member" DROP COLUMN "password"');
//         await queryRunner.query('ALTER TABLE "item" DROP COLUMN "creator"');
//         await queryRunner.query('ALTER TABLE "item" DROP COLUMN "mpath"');
//         await queryRunner.query('ALTER TABLE "item" DROP COLUMN "parentId"');
//         await queryRunner.query('ALTER TABLE "chat_message" DROP COLUMN "chat_id"');
//         await queryRunner.query('ALTER TABLE "chat_message" DROP COLUMN "creator"');
//         await queryRunner.query('ALTER TABLE "chat_mention" DROP COLUMN "item_path"');
//         await queryRunner.query('ALTER TABLE "chat_mention" DROP COLUMN "creator"');
//         await queryRunner.query('ALTER TABLE "invitation" DROP COLUMN "creator"');
//         await queryRunner.query('ALTER TABLE "app_data" DROP COLUMN "creator"');
//         await queryRunner.query('ALTER TABLE "app_setting" DROP COLUMN "creator"');
//         await queryRunner.query('ALTER TABLE "item_validation_group" DROP COLUMN "item_validation_id"');
//         await queryRunner.query('ALTER TABLE "item_validation_group" DROP COLUMN "item_validation_process_id"');
//         await queryRunner.query('ALTER TABLE "item_validation_group" DROP COLUMN "status_id"');
//         await queryRunner.query('ALTER TABLE "item_validation_group" DROP COLUMN "result"');
//         await queryRunner.query('ALTER TABLE "item_validation_group" DROP COLUMN "updated_at"');
//         await queryRunner.query('ALTER TABLE "item_validation_review" DROP COLUMN "status_id"');


//         await queryRunner.query('ALTER TABLE "item_category" DROP COLUMN "item_id"');
//         await queryRunner.query('ALTER TABLE "item_membership" DROP COLUMN "creator"');
//         await queryRunner.query('ALTER TABLE "item_tag" DROP CONSTRAINT "item_tag_pkey"');
//         await queryRunner.query('ALTER TABLE "item_tag" DROP COLUMN "tag_id"');
//         await queryRunner.query('ALTER TABLE "item_tag" DROP COLUMN "creator"');
//         await queryRunner.query('ALTER TABLE "publisher" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "app" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "item_validation" ADD "process" character varying NOT NULL');
//         await queryRunner.query('ALTER TABLE "item_validation" ADD "status" character varying NOT NULL');
//         await queryRunner.query('ALTER TABLE "item_validation" ADD "result" character varying');
//         await queryRunner.query('ALTER TABLE "item_validation" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "item_validation" ADD "item_validation_group_id" uuid');
//         await queryRunner.query('ALTER TABLE "item_validation_review" ADD "status" character varying NOT NULL');
//         await queryRunner.query('ALTER TABLE "item_category" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()');
        

//         await queryRunner.query('ALTER TABLE "item_membership" ADD "creator_id" uuid');



//         await queryRunner.query('ALTER TABLE "item_tag" ADD "creator_id" uuid');





//         await queryRunner.query('ALTER TABLE "member" ALTER COLUMN "created_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "item" ALTER COLUMN "created_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "item" ALTER COLUMN "updated_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "member" ALTER COLUMN "updated_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "chat_message" ALTER COLUMN "created_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "chat_message" ALTER COLUMN "updated_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "chat_message" ALTER COLUMN "body" SET NOT NULL');
//         await queryRunner.query('ALTER TABLE "chat_mention" ALTER COLUMN "created_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "chat_mention" ALTER COLUMN "updated_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TYPE "public"."mention_status" RENAME TO "mention_status_old"');
//         await queryRunner.query('CREATE TYPE "public"."chat_mention_status_enum" AS ENUM(\'unread\', \'read\')');
//         await queryRunner.query('ALTER TABLE "chat_mention" ALTER COLUMN "status" DROP DEFAULT');
//         await queryRunner.query('ALTER TABLE "chat_mention" ALTER COLUMN "status" TYPE "public"."chat_mention_status_enum" USING "status"::"text"::"public"."chat_mention_status_enum"');
//         await queryRunner.query('ALTER TABLE "chat_mention" ALTER COLUMN "status" SET DEFAULT \'unread\'');
//         await queryRunner.query('DROP TYPE "public"."mention_status_old"');
//         await queryRunner.query('ALTER TABLE "invitation" ALTER COLUMN "id" SET NOT NULL');
//         await queryRunner.query('ALTER TABLE "invitation" ADD CONSTRAINT "invitation_pkey" PRIMARY KEY ("item_path", "email", "id")');
//         await queryRunner.query('ALTER TABLE "invitation" DROP CONSTRAINT "invitation_id_key"');
//         await queryRunner.query('ALTER TABLE "invitation" ALTER COLUMN "name" DROP DEFAULT');
//         await queryRunner.query('ALTER TABLE "invitation" ALTER COLUMN "created_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "invitation" ALTER COLUMN "updated_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "app_action" DROP COLUMN "type"');
//         await queryRunner.query('ALTER TABLE "app_action" ADD "type" character varying NOT NULL');
//         await queryRunner.query('ALTER TABLE "app_action" DROP COLUMN "data"');
//         await queryRunner.query('ALTER TABLE "app_action" ADD "data" text NOT NULL DEFAULT \'{}\'');
//         await queryRunner.query('ALTER TABLE "app_action" ALTER COLUMN "created_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "app_data" ALTER COLUMN "created_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "app_data" ALTER COLUMN "updated_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "app_setting" ALTER COLUMN "created_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "app_setting" ALTER COLUMN "updated_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "publisher" ADD CONSTRAINT "UQ_9dc496f2e5b912da9edd2aa4455" UNIQUE ("name")');

//         await queryRunner.query('ALTER TABLE "publisher" ALTER COLUMN "created_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "app" DROP COLUMN "key"');
//         await queryRunner.query('ALTER TABLE "app" ADD "key" uuid NOT NULL DEFAULT uuid_generate_v4()');
//         await queryRunner.query('ALTER TABLE "app" ADD CONSTRAINT "UQ_62673246a7c877eeebe13ce6693" UNIQUE ("key")');
//         await queryRunner.query('ALTER TABLE "app" ADD CONSTRAINT "UQ_c5dad04bce0533c91ceaedd9bbc" UNIQUE ("url")');
     
//         await queryRunner.query('ALTER TABLE "app" ALTER COLUMN "created_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "item_validation_group" ALTER COLUMN "created_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "item_validation" ALTER COLUMN "created_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "item_validation_review" DROP COLUMN "reason"');
//         await queryRunner.query('ALTER TABLE "item_validation_review" ADD "reason" character varying');
//         await queryRunner.query('ALTER TABLE "item_validation_review" ALTER COLUMN "updated_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "item_validation_review" ALTER COLUMN "created_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "item_validation_review" ALTER COLUMN "item_validation_id" DROP NOT NULL');

//         await queryRunner.query('ALTER TABLE "item_category" ALTER COLUMN "id" SET NOT NULL');
//         await queryRunner.query('ALTER TABLE "item_category" ADD CONSTRAINT "item_category_pkey" PRIMARY KEY ("category_id", "id")');
//         await queryRunner.query('ALTER TABLE "item_flag" ALTER COLUMN "created_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "item_membership" DROP CONSTRAINT "item_membership_pkey"');
//         await queryRunner.query('ALTER TABLE "item_membership" ADD CONSTRAINT "item_membership_pkey" PRIMARY KEY ("member_id", "item_path", "id")');
//         await queryRunner.query('ALTER TABLE "item_membership" DROP CONSTRAINT "item_membership_id_key"');
//         await queryRunner.query('ALTER TABLE "item_membership" ALTER COLUMN "created_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "item_membership" ALTER COLUMN "updated_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "item_tag" ADD CONSTRAINT "item_tag_pkey" PRIMARY KEY ("item_path", "id")');
//         await queryRunner.query('ALTER TABLE "item_tag" DROP CONSTRAINT "item_tag_id_key"');
//         await queryRunner.query('ALTER TABLE "item_tag" ALTER COLUMN "created_at" SET DEFAULT now()');
//         await queryRunner.query('ALTER TABLE "invitation" ADD CONSTRAINT "item-email" UNIQUE ("item_path", "email")');
//         await queryRunner.query('ALTER TABLE "category" ADD CONSTRAINT "category-name-type" UNIQUE ("name", "type")');
//         await queryRunner.query('ALTER TABLE "item_category" ADD CONSTRAINT "category-item" UNIQUE ("category_id", "item_path")');
//         await queryRunner.query('ALTER TABLE "item_flag" ADD CONSTRAINT "item-flag-creator" UNIQUE ("item_id", "flag_type", "creator_id")');
//         await queryRunner.query('ALTER TABLE "item_membership" ADD CONSTRAINT "item-member" UNIQUE ("item_path", "member_id")');
//         await queryRunner.query('ALTER TABLE "item_tag" ADD CONSTRAINT "item-tag" UNIQUE ("item_path", "type")');
//         await queryRunner.query('ALTER TABLE "member_password" ADD CONSTRAINT "FK_81ea11a0e4f243edf76d53c2843" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "item" ADD CONSTRAINT "FK_bdc46717fadc2f04f3093e51fd5" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "chat_message" ADD CONSTRAINT "FK_b31e627ea7a4787672e265a1579" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "chat_message" ADD CONSTRAINT "FK_ef7b3a413b9b33e756b31734976" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "chat_mention" ADD CONSTRAINT "FK_e5199951167b722215127651e7c" FOREIGN KEY ("message_id") REFERENCES "chat_message"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "chat_mention" ADD CONSTRAINT "FK_f22de4941ca58910967a5626755" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "invitation" ADD CONSTRAINT "FK_7ad4a490d5b9f79a677827b641c" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "invitation" ADD CONSTRAINT "FK_dc1d92accde1c2fbb7e729e4dcc" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE');
//         await queryRunner.query('ALTER TABLE "app_action" ADD CONSTRAINT "FK_c415fc186dda51fa260d338d776" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "app_action" ADD CONSTRAINT "FK_7750f85aef0f67acdbcb904395a" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "app_data" ADD CONSTRAINT "FK_8c3e2463c67d9865658941c9e2d" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "app_data" ADD CONSTRAINT "FK_27cb180cb3f372e4cf55302644a" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "app_data" ADD CONSTRAINT "FK_b8c8a36a32850e3096451a8b727" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "app_setting" ADD CONSTRAINT "FK_f5922b885e2680beab8add96008" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "app_setting" ADD CONSTRAINT "FK_22d3d051ee6f94932c1373a3d09" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "app" ADD CONSTRAINT "FK_37eb7baab82e11150157ec0b5a6" FOREIGN KEY ("publisher_id") REFERENCES "publisher"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "recycled_item_data" ADD CONSTRAINT "FK_3e3650ebd5c49843013429d510a" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "recycled_item_data" ADD CONSTRAINT "FK_f8a4db4476e3d81e18de5d63c42" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE');
//         await queryRunner.query('ALTER TABLE "item_validation_group" ADD CONSTRAINT "FK_a9e83cf5f53c026b774b53d3c60" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "item_validation" ADD CONSTRAINT "FK_d60969d5e478e7c844532ac4e7f" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "item_validation" ADD CONSTRAINT "FK_e92da280941f666acf87baedc65" FOREIGN KEY ("item_validation_group_id") REFERENCES "item_validation_group"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "item_validation_review" ADD CONSTRAINT "FK_59fd000835c70c728e525d82950" FOREIGN KEY ("item_validation_id") REFERENCES "item_validation"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "item_validation_review" ADD CONSTRAINT "FK_44bf14fee580ae08702d70e622e" FOREIGN KEY ("reviewer_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "item_category" ADD CONSTRAINT "FK_638552fc7d9a2035c2b53182d8a" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "item_category" ADD CONSTRAINT "FK_9a34a079b5b24f4396462546d26" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "item_category" ADD CONSTRAINT "FK_5681d1785eea699e9cae8818fe0" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE');
//         await queryRunner.query('ALTER TABLE "item_flag" ADD CONSTRAINT "FK_b04d0adf4b73d82537c92fa55ea" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "item_flag" ADD CONSTRAINT "FK_bde9b9ab1da1483a71c9b916dd2" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "item_like" ADD CONSTRAINT "FK_4a56eba1ce30dc93f118a51ff26" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "item_like" ADD CONSTRAINT "FK_159827eb667d019dc71372d7463" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "item_login_schema" ADD CONSTRAINT "FK_b4a263d8c8392a73e0a1febf7d3" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE');
//         await queryRunner.query('ALTER TABLE "item_login" ADD CONSTRAINT "FK_342f83bdd41dbd854c1328cd684" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "item_login" ADD CONSTRAINT "FK_aad7e4bae30d6da99c3cd7e4bfd" FOREIGN KEY ("item_login_schema_id") REFERENCES "item_login_schema"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "item_membership" ADD CONSTRAINT "FK_25b6506de99e92886ed97174ab8" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "item_membership" ADD CONSTRAINT "FK_da1b92e08975efd46df22512884" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "item_membership" ADD CONSTRAINT "FK_d935785e7ecc015ed3ca048ff05" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE');
//         await queryRunner.query('ALTER TABLE "item_tag" ADD CONSTRAINT "FK_354758ae1c8199f9b4a66ffb6a3" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "item_tag" ADD CONSTRAINT "FK_9efd997d733334e84e22410592c" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE');
//         await queryRunner.query('ALTER TABLE "item_published" ADD CONSTRAINT "FK_bfeeeb8d1257029e4d7f7ec1375" FOREIGN KEY ("creator_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION');
//         await queryRunner.query('ALTER TABLE "item_published" ADD CONSTRAINT "FK_490fddd9099ee7ddcccf8c776a1" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE');
//         await queryRunner.query('DROP TYPE "public"."permissions_enum"');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // do nothing
        
       }

}
