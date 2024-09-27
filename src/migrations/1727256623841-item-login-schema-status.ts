import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1727256623841 implements MigrationInterface {
  name = 'item-login-schema-status-1727256623841';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "item_login_schema" ADD "status" character varying(100) NOT NULL DEFAULT 'active'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item_login_schema" DROP COLUMN "status"`);
  }
}
