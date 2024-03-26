import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1711463030601 implements MigrationInterface {
  name = 'Migrations1711463030601';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item" ADD "is_public" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "item" ADD "is_hidden" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(
      `UPDATE item SET is_public = true WHERE EXISTS (SELECT 1 FROM item_tag WHERE item.path = item_tag.item_path AND item_tag.type = 'public');`,
    );
    await queryRunner.query(
      `UPDATE item SET is_hidden = true WHERE EXISTS (SELECT 1 FROM item_tag WHERE item.path = item_tag.item_path AND item_tag.type = 'hidden');`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "is_hidden"`);
    await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "is_public"`);
  }
}
