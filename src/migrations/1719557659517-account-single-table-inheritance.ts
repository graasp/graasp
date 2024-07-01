import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1719557659517 implements MigrationInterface {
  name = 'Migrations1719557659517';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "member" RENAME TO "account"`);
    await queryRunner.query(`ALTER TABLE "account" ADD "item_login_schema_id" uuid`);
    await queryRunner.query(`ALTER TABLE "account" ALTER COLUMN "email" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "account" ALTER COLUMN "extra" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "account" ALTER COLUMN "enable_save_actions" DROP NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "account" ALTER COLUMN "is_validated" DROP NOT NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_3c76f178c5065d1ab304b5832e" ON "account" ("type") `);
    await queryRunner.query(
      `ALTER TABLE "account" ADD CONSTRAINT "FK_36febb6e928417ee3da60b276bb" FOREIGN KEY ("item_login_schema_id") REFERENCES "item_login_schema"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD CONSTRAINT "CHK_2e15a5c8f4b8cbefd2893cbc76" CHECK ("is_validated" IS NOT NULL OR "type" != 'individual')`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD CONSTRAINT "CHK_3ebb4489925cf629da58f774c1" CHECK ("enable_save_actions" IS NOT NULL OR "type" != 'individual')`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD CONSTRAINT "CHK_39676d6a067e6820fa98ef2429" CHECK ("extra" IS NOT NULL OR "type" != 'individual')`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD CONSTRAINT "CHK_749bae0201583c92d625ab827a" CHECK ("email" IS NOT NULL OR "type" != 'individual')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "account" DROP CONSTRAINT "CHK_749bae0201583c92d625ab827a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" DROP CONSTRAINT "CHK_39676d6a067e6820fa98ef2429"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" DROP CONSTRAINT "CHK_3ebb4489925cf629da58f774c1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" DROP CONSTRAINT "CHK_2e15a5c8f4b8cbefd2893cbc76"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" DROP CONSTRAINT "FK_36febb6e928417ee3da60b276bb"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_3c76f178c5065d1ab304b5832e"`);
    await queryRunner.query(`ALTER TABLE "account" ALTER COLUMN "is_validated" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "account" ALTER COLUMN "enable_save_actions" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "account" ALTER COLUMN "extra" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "account" ALTER COLUMN "email" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "account" DROP COLUMN "item_login_schema_id"`);
    await queryRunner.query(`ALTER TABLE "account" RENAME TO "member"`);
  }
}
