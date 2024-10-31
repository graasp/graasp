import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1730388006604 implements MigrationInterface {
  name = 'get-own-recycled-incides-1730388006604';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_gist_recycled_item_data_item_path" ON "recycled_item_data" USING GIST (item_path)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_recycled_item_data_created_at" ON "recycled_item_data" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_item_membership_account_id_permission" ON "item_membership" ("account_id", "permission") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_gist_recycled_item_data_item_path"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_item_membership_account_id_permission"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_recycled_item_data_created_at"`);
  }
}
