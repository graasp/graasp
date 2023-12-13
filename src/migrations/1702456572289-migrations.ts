import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1702456572289 implements MigrationInterface {
  name = 'Migrations1702456572289';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_61546c650608c1e68789c64915" ON "app_setting" ("item_id", "name") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_61546c650608c1e68789c64915"`);
  }
}
