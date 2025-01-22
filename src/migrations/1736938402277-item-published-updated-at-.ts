import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1736938402277 implements MigrationInterface {
  name = 'item-published-updated-at-1736938402277';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "item_published" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`UPDATE "item_published" SET updated_at = created_at`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item_published" DROP COLUMN "updated_at"`);
  }
}
