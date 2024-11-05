import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1730798658866 implements MigrationInterface {
  name = 'item-visibility-1730798658866';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item_tag" RENAME TO "item_visibility"`);
    await queryRunner.query(
      `ALTER INDEX "IDX_gist_item_tag_path" RENAME TO "IDX_gist_item_visibility_path"`,
    );
    await queryRunner.query(
      `ALTER TABLE "item_visibility" RENAME CONSTRAINT "item-tag" TO "UQ_item_visibility_item_type"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER INDEX "IDX_gist_item_visibility_path" RENAME TO "IDX_gist_item_tag_path"`,
    );
    await queryRunner.query(
      `ALTER TABLE "item_visibility" RENAME CONSTRAINT "UQ_item_visibility_item_type" TO "item-tag"`,
    );
    await queryRunner.query(`ALTER TABLE "item_visibility" RENAME TO "item_tag"`);
  }
}
