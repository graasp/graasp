import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1724225602329 implements MigrationInterface {
  name = 'account-single-table-inheritance-1724225602329';

  public async up(queryRunner: QueryRunner): Promise<void> {
    //--- Rename tables and columns ---//
    // 1. Rename member to account
    await queryRunner.query(`ALTER TABLE "member" RENAME TO "account"`);

    // 2. Rename item_membership.member_id to account_id
    await queryRunner.query(
      `ALTER TABLE "item_membership" RENAME COLUMN "member_id" TO "account_id"`,
    );

    // 3. Rename app_data.member_id to account_id
    await queryRunner.query(`ALTER TABLE "app_data" RENAME COLUMN "member_id" TO "account_id"`);

    // 4. Rename app_action.member_id to account_id
    await queryRunner.query(`ALTER TABLE "app_action" RENAME COLUMN "member_id" TO "account_id"`);

    // 5. Rename action.member_id to account_id
    await queryRunner.query(`ALTER TABLE "action" RENAME COLUMN "member_id" TO "account_id"`);

    // 6. Rename chat_mention.member_id to account_id
    await queryRunner.query(`ALTER TABLE "chat_mention" RENAME COLUMN "member_id" TO "account_id"`);

    //--- Table Model ---//
    // 7. Add guest_password table
    await queryRunner.query(
      `CREATE TABLE "guest_password" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "password" character varying(100) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "guest_id" uuid, CONSTRAINT "UQ_guest_password_guest_id" UNIQUE ("guest_id"), CONSTRAINT "REL_c2f3563d93e3ffe19f60e6d869" UNIQUE ("guest_id"), CONSTRAINT "PK_603c36c6f9e303e1dd847366731" PRIMARY KEY ("id"))`,
    );

    // 8. Add account.item_login_schema_id
    await queryRunner.query(`ALTER TABLE "account" ADD "item_login_schema_id" uuid`);

    //--- Checks ---//
    // 9. Drop account.email not null constraint
    await queryRunner.query(`ALTER TABLE "account" ALTER COLUMN "email" DROP NOT NULL`);

    // 10. Add account.email not null constraint when type is not individual
    await queryRunner.query(
      `ALTER TABLE "account" ADD CONSTRAINT "CHK_account_email" CHECK ("email" IS NOT NULL OR "type" != 'individual')`,
    );

    // 11. Drop account.extra not null constraint
    await queryRunner.query(`ALTER TABLE "account" ALTER COLUMN "extra" DROP NOT NULL`);

    // 12. Add account.extra not null constraint when type is not individual
    await queryRunner.query(
      `ALTER TABLE "account" ADD CONSTRAINT "CHK_account_extra" CHECK ("extra" IS NOT NULL OR "type" != 'individual')`,
    );

    // 13. Drop account.enable_save_actions not null constraint
    await queryRunner.query(
      `ALTER TABLE "account" ALTER COLUMN "enable_save_actions" DROP NOT NULL`,
    );

    // 14. Add account.enable_save_actions not null constraint when type is not individual
    await queryRunner.query(
      `ALTER TABLE "account" ADD CONSTRAINT "CHK_account_enable_save_actions" CHECK ("enable_save_actions" IS NOT NULL OR "type" != 'individual')`,
    );

    // 15. Drop account.is_validated not null constraint
    await queryRunner.query(`ALTER TABLE "account" ALTER COLUMN "is_validated" DROP NOT NULL`);

    // 16. Add account.is_validated not null constraint when type is not individual
    await queryRunner.query(
      `ALTER TABLE "account" ADD CONSTRAINT "CHK_account_is_validated" CHECK ("is_validated" IS NOT NULL OR "type" != 'individual')`,
    );

    // 17. Add account.name and account.item_login_schema_id pair unique constraint
    await queryRunner.query(
      `ALTER TABLE "account" ADD CONSTRAINT "UQ_account_name_item_login_schema_id" UNIQUE ("name", "item_login_schema_id")`,
    );

    //-- Indexes --//
    // 18. Add account.type index
    await queryRunner.query(`CREATE INDEX "IDX_account_type" ON "account" ("type") `);

    // 19. Rename item_membership.account_id index
    await queryRunner.query(
      `ALTER INDEX "public"."IDX_da1b92e08975efd46df2251288" RENAME TO "IDX_item_membership_account_id"`,
    );

    // 20. Rename action.account_id index
    await queryRunner.query(
      `ALTER INDEX "public"."IDX_266df04a901f13e3c666504a0f" RENAME TO "IDX_action_account_id"`,
    );

    //-- Foreign Keys --//
    // 21. Add account.item_login_schema_id foreign key
    await queryRunner.query(
      `ALTER TABLE "account" ADD CONSTRAINT "FK_account_item_login_schema_id" FOREIGN KEY ("item_login_schema_id") REFERENCES "item_login_schema"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // 22. Add guest_password.guest_id foreign key
    await queryRunner.query(
      `ALTER TABLE "guest_password" ADD CONSTRAINT "FK_guest_password_guest_id" FOREIGN KEY ("guest_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // 23. Rename member_password.account_id foreign key
    await queryRunner.query(
      `ALTER TABLE "member_password" RENAME CONSTRAINT "FK_81ea11a0e4f243edf76d53c2843" TO "FK_member_password_member_id"`,
    );

    // 24. Rename item_membership.account_id foreign key
    await queryRunner.query(
      `ALTER TABLE "item_membership" RENAME CONSTRAINT "FK_da1b92e08975efd46df22512884" TO "FK_item_membership_account_id"`,
    );

    // 25. Rename app_data.account_id foreign key
    await queryRunner.query(
      `ALTER TABLE "app_data" RENAME CONSTRAINT "FK_b8c8a36a32850e3096451a8b727" TO "FK_app_data_account_id"`,
    );

    // 26. Rename app_action.account_id foreign key
    await queryRunner.query(
      `ALTER TABLE "app_action" RENAME CONSTRAINT "FK_7750f85aef0f67acdbcb904395a" TO "FK_app_action_account_id"`,
    );

    // 27. Rename action.account_id foreign key
    await queryRunner.query(
      `ALTER TABLE "action" RENAME CONSTRAINT "FK_266df04a901f13e3c666504a0fb" TO "FK_action_account_id"`,
    );

    // 28. Rename chat_mention.account_id foreign key
    await queryRunner.query(
      `ALTER TABLE "chat_mention" RENAME CONSTRAINT "FK_f22de4941ca58910967a5626755" TO "FK_chat_mention_account_id"`,
    );
    //-- Migrate data --//
    // 29. Insert guest_password from item_login.password
    await queryRunner.query(
      `INSERT INTO guest_password (guest_id, password) SELECT member_id, password FROM item_login WHERE password IS NOT NULL`,
    );

    // 30. Update members from item_login
    await queryRunner.query(
      `UPDATE account SET type = 'guest', email = NULL, is_validated = false, item_login_schema_id = item_login.item_login_schema_id FROM item_login WHERE account.id = item_login.id`,
    );

    // 31. Drop item_login.item_login_schema_id foreign keys
    await queryRunner.query(
      `ALTER TABLE "item_login" DROP CONSTRAINT "FK_d2a1fec675a75e8ae1b2a73b0c0"`,
    );

    // 32. Drop item_login.member_id foreign keys
    await queryRunner.query(
      `ALTER TABLE "item_login" DROP CONSTRAINT "FK_342f83bdd41dbd854c1328cd684"`,
    );

    // 33. Drop item_login
    await queryRunner.query(`DROP TABLE "item_login"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    //-- Migrate data --//
    // 33. Create item_login
    await queryRunner.query(
      `CREATE TABLE "item_login" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "password" character varying(100), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "member_id" uuid NOT NULL, "item_login_schema_id" uuid, CONSTRAINT "item-login-member" UNIQUE ("item_login_schema_id", "member_id"), CONSTRAINT "PK_5fa834add54f1c5262a1b012e50" PRIMARY KEY ("id"))`,
    );

    // 32. Add item_login.member_id foreign keys
    await queryRunner.query(
      `ALTER TABLE "item_login" ADD CONSTRAINT "FK_342f83bdd41dbd854c1328cd684" FOREIGN KEY ("member_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // 31. Add item_login.item_login_schema_id foreign keys
    await queryRunner.query(
      `ALTER TABLE "item_login" ADD CONSTRAINT "FK_d2a1fec675a75e8ae1b2a73b0c0" FOREIGN KEY ("item_login_schema_id") REFERENCES "item_login_schema"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // 30. Update members
    await queryRunner.query(
      `UPDATE account SET type = 'individual', email = LEFT(MD5(RANDOM()::text), 4) || '-' || (EXTRACT(EPOCH FROM (created_at AT TIME ZONE 'UTC')) * 1000)::BigInt || '@graasp.org', is_validated = true FROM item_login WHERE type = 'guest'`,
    );

    // 30.b Insert into item_login from members and guest_password
    await queryRunner.query(
      `INSERT INTO item_login (password, member_id, item_login_schema_id) SELECT guest_password.password, account.id, account.item_login_schema_id FROM account LEFT JOIN guest_password ON account.id = guest_password.guest_id`,
    );

    // 29. Delete guest_password from item_login.password
    await queryRunner.query(
      `DELETE FROM guest_password WHERE id IN (SELECT member_id FROM item_login)`,
    );

    //-- Foreign Keys --//
    // 28. Rename chat_mention.account_id foreign key
    await queryRunner.query(
      `ALTER TABLE "chat_mention" RENAME CONSTRAINT "FK_chat_mention_account_id" TO "FK_f22de4941ca58910967a5626755"`,
    );

    // 27. Rename action.account_id foreign key
    await queryRunner.query(
      `ALTER TABLE "action" RENAME CONSTRAINT "FK_action_account_id" TO "FK_266df04a901f13e3c666504a0fb"`,
    );

    // 26. Rename app_action.account_id foreign key
    await queryRunner.query(
      `ALTER TABLE "app_action" RENAME CONSTRAINT "FK_app_action_account_id", "FK_7750f85aef0f67acdbcb904395a" `,
    );

    // 25. Rename app_data.account_id foreign key
    await queryRunner.query(
      `ALTER TABLE "app_data" RENAME CONSTRAINT "FK_app_data_account_id" TO "FK_b8c8a36a32850e3096451a8b727"`,
    );

    // 24. Rename item_membership.account_id foreign key
    await queryRunner.query(
      `ALTER TABLE "item_membership" RENAME CONSTRAINT "FK_item_membership_account_id" TO "FK_da1b92e08975efd46df22512884"`,
    );

    // 23. Rename member_password.account_id foreign key
    await queryRunner.query(
      `ALTER TABLE "member_password" RENAME CONSTRAINT "FK_member_password_member_id" TO "FK_81ea11a0e4f243edf76d53c2843"`,
    );

    // 22. Drop guest_password.guest_id foreign key
    await queryRunner.query(
      `ALTER TABLE "guest_password" DROP CONSTRAINT "FK_guest_password_guest_id"`,
    );

    // 21. Drop account.item_login_schema_id foreign key
    await queryRunner.query(
      `ALTER TABLE "account" DROP CONSTRAINT "FK_account_item_login_schema_id"`,
    );

    //-- Indexes --//
    // 20. Rename action.account_id index
    await queryRunner.query(
      `ALTER INDEX "public"."IDX_action_account_id" RENAME TO "IDX_266df04a901f13e3c666504a0f"`,
    );

    // 19. Rename item_membership.account_id index
    await queryRunner.query(
      `ALTER INDEX "public"."IDX_item_membership_account_id" RENAME TO "IDX_da1b92e08975efd46df2251288"`,
    );

    // 18. Drop account.type index
    await queryRunner.query(`DROP INDEX "public"."IDX_account_type"`);

    //--- Checks ---//
    // 17. Drop account.name and account.item_login_schema_id pair unique constraint
    await queryRunner.query(
      `ALTER TABLE "account" DROP CONSTRAINT "UQ_account_name_item_login_schema_id"`,
    );

    // 16. Drop account.is_validated not null constraint when type is not individual
    await queryRunner.query(`ALTER TABLE "account" DROP CONSTRAINT "CHK_account_is_validated"`);

    // 15. Add account.is_validated not null constraint
    await queryRunner.query(`ALTER TABLE "account" ALTER COLUMN "is_validated" SET NOT NULL`);

    // 14. Drop account.enable_save_actions not null constraint when type is not individual
    await queryRunner.query(
      `ALTER TABLE "account" DROP CONSTRAINT "CHK_account_enable_save_actions"`,
    );

    // 13. Add account.enable_save_actions not null constraint
    await queryRunner.query(
      `ALTER TABLE "account" ALTER COLUMN "enable_save_actions" SET NOT NULL`,
    );

    // 12. Drop account.extra not null constraint when type is not individual
    await queryRunner.query(`ALTER TABLE "account" DROP CONSTRAINT "CHK_account_extra"`);

    // 11. Add account.extra not null constraint
    await queryRunner.query(`ALTER TABLE "account" ALTER COLUMN "extra" SET NOT NULL`);

    // 10. Drop account.email not null constraint when type is not individual
    await queryRunner.query(`ALTER TABLE "account" DROP CONSTRAINT "CHK_account_email"`);

    // 9. Add account.email not null constraint
    await queryRunner.query(`ALTER TABLE "account" ALTER COLUMN "email" SET NOT NULL`);

    //--- Table Model ---//
    // 8. Drop account.item_login_schema_id
    await queryRunner.query(`ALTER TABLE "account" DROP COLUMN "item_login_schema_id"`);

    // 7. Drop guest_password table
    await queryRunner.query(`DROP TABLE "guest_password"`);

    //--- Renaming tables and columns ---//
    // 6. Rename chat_mention.account_id to member_id
    await queryRunner.query(`ALTER TABLE "chat_mention" RENAME COLUMN "account_id" TO "member_id"`);

    // 5. Rename action.account_id to member_id
    await queryRunner.query(`ALTER TABLE "action" RENAME COLUMN "account_id" TO "member_id"`);

    // 4. Rename app_action.account_id to member_id
    await queryRunner.query(`ALTER TABLE "app_action" RENAME COLUMN "account_id" TO "member_id"`);

    // 3. Rename app_data.account_id to member_id
    await queryRunner.query(`ALTER TABLE "app_data" RENAME COLUMN "account_id" TO "member_id"`);

    // 2. Rename item_membership.account_id to member_id
    await queryRunner.query(
      `ALTER TABLE "item_membership" RENAME COLUMN "account_id" TO "member_id"`,
    );

    // 1. Rename account to member
    await queryRunner.query(`ALTER TABLE "account" RENAME TO "member"`);
  }
}
