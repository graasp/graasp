import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1730388006604 implements MigrationInterface {
  name = 'membership-account-permission-index-1730388006604';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_item_membership_account_id_permission" ON "item_membership" ("account_id", "permission") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_item_membership_account_id_permission"`);
  }
}
