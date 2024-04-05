import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1711101133700 implements MigrationInterface {
  name = 'Migrations1711101133700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item" ADD "display_name" character varying(500)`);
    await queryRunner.query(`UPDATE "item" SET "display_name" = "name"`);
    await queryRunner.query(`ALTER TABLE "item" ALTER COLUMN "display_name" SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "display_name"`);
  }
}
