import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1702552816415 implements MigrationInterface {
  name = 'Migrations1702552816415';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_61546c650608c1e68789c64915" ON "app_setting" ("item_id", "name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6079b3bb63c13f815f7dd8d8a2" ON "app_data" ("type") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_61546c650608c1e68789c64915"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6079b3bb63c13f815f7dd8d8a2"`);
  }
}
