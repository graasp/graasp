import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1736512586095 implements MigrationInterface {
  name = 'item-like-index-item-1736512586095';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_item_like_item" ON "item_like" ("item_id") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_item_like_item"`);
  }
}
