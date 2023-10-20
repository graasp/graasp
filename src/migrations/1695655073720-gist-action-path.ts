import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1695655073720 implements MigrationInterface {
  name = 'gist-action-path-1695655073720';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // drop action item_path index
    await queryRunner.query(`DROP INDEX "public"."IDX_d1e204f54e77573838087f3c15"`);

    await queryRunner.query(
      `CREATE INDEX "IDX_266df04a901f13e3c666504a0f" ON "action" ("member_id") `,
    );

    // create action item_path special index
    await queryRunner.query(
      `CREATE INDEX "IDX_gist_action_path" ON "action" USING GIST (item_path)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_266df04a901f13e3c666504a0f"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_d1e204f54e77573838087f3c15" ON "action" ("item_path") `,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_gist_action_path"`);
  }
}
