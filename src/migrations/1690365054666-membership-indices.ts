import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1690365054666 implements MigrationInterface {
  name = 'Migrations1690365054666';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_bdc46717fadc2f04f3093e51fd" ON "item" ("creator_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d1e204f54e77573838087f3c15" ON "action" ("item_path") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5ac5bdde333fca6bbeaf177ef9" ON "item_membership" ("permission") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_da1b92e08975efd46df2251288" ON "item_membership" ("member_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d935785e7ecc015ed3ca048ff0" ON "item_membership" ("item_path") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_d935785e7ecc015ed3ca048ff0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_da1b92e08975efd46df2251288"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_5ac5bdde333fca6bbeaf177ef9"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d1e204f54e77573838087f3c15"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bdc46717fadc2f04f3093e51fd"`);
  }
}
