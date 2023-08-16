import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1691062874841 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_gist_item_path" ON "item" USING GIST (path)`);
    await queryRunner.query(
      `CREATE INDEX "IDX_gist_item_membership_path" ON "item_membership" USING GIST (item_path)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_gist_item_tag_path" ON "item_tag" USING GIST (item_path)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_gist_item_published_path" ON "item_published" USING GIST (item_path)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_gist_item_path"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_gist_item_membership_path"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_gist_item_tag_path"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_gist_item_published_path"`);
  }
}
