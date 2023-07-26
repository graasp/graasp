import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1690359576885 implements MigrationInterface {
  name = 'Migrations1690359576885';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_5ac5bdde333fca6bbeaf177ef9" ON "item_membership" ("permission") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_25b6506de99e92886ed97174ab" ON "item_membership" ("creator_id") `,
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
    await queryRunner.query(`DROP INDEX "public"."IDX_25b6506de99e92886ed97174ab"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_5ac5bdde333fca6bbeaf177ef9"`);
  }
}
