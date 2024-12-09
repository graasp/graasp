import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1733751673963 implements MigrationInterface {
  name = 'remove-display-name-1733751673963';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "display_name"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "item" ADD "display_name" character varying(500) NOT NULL`,
    );
  }
}
