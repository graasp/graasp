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
    await queryRunner.query(
      `ALTER TABLE "item_visibility" RENAME CONSTRAINT "FK_354758ae1c8199f9b4a66ffb6a3" TO "FK_item_visibility_creator"`,
    );
    await queryRunner.query(
      `ALTER TABLE "item_visibility" RENAME CONSTRAINT "FK_9efd997d733334e84e22410592c" TO "FK_item_visibility_item"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER INDEX "IDX_gist_item_visibility_path" RENAME TO "IDX_gist_item_tag_path"`,
    );
    await queryRunner.query(
      `ALTER TABLE "item_visibility" RENAME CONSTRAINT "UQ_item_visibility_item_type" TO "item-tag"`,
    );
    await queryRunner.query(
      `ALTER TABLE "item_visibility" RENAME CONSTRAINT "FK_item_visibility_creator" TO "FK_354758ae1c8199f9b4a66ffb6a3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "item_visibility" RENAME CONSTRAINT "FK_item_visibility_item" TO "FK_9efd997d733334e84e22410592c"`,
    );
    await queryRunner.query(`ALTER TABLE "item_visibility" RENAME TO "item_tag"`);
  }
}
