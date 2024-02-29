import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1709215939615 implements MigrationInterface {
  name = 'action-item-id-1709215939615';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action" DROP CONSTRAINT "FK_d1e204f54e77573838087f3c153"`,
    );
    await queryRunner.query(`ALTER TABLE "action" ADD "item_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "action" ADD CONSTRAINT "FK_1214f6f4d832c402751617361c0" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE SET NULL`,
    );
    // move path data to id
    await queryRunner.query(
      `UPDATE action SET item_id = (SELECT id FROM item WHERE item.path = action.item_path )`,
    );
    // remove previous action item_path
    await queryRunner.query(`DROP INDEX "public"."IDX_gist_action_path"`);
    await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "item_path"`);

    // create action item_id index
    await queryRunner.query(
      `CREATE INDEX "IDX_1214f6f4d832c402751617361c" ON "action" ("item_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action" DROP CONSTRAINT "FK_1214f6f4d832c402751617361c0"`,
    );

    // remove action item_id index
    await queryRunner.query(`DROP INDEX "public"."IDX_1214f6f4d832c402751617361c"`);
    await queryRunner.query(`ALTER TABLE "action" ADD "item_path" uuid`);
    await queryRunner.query(
      `UPDATE action SET item_path = (SELECT path FROM item WHERE item.id = action.item_id )`,
    );

    await queryRunner.query(
      'ALTER TABLE "action" ADD CONSTRAINT "FK_d1e204f54e77573838087f3c153" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE SET NULL ON UPDATE CASCADE',
    );
    await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "item_id"`);

    // create action item_path special index
    await queryRunner.query(
      `CREATE INDEX "IDX_gist_action_path" ON "action" USING GIST (item_path)`,
    );
  }
}
