import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1712230247740 implements MigrationInterface {
  name = 'enable-save-actions-1712230247740';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "member" ADD "enable_save_actions" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "member" DROP COLUMN "enable_save_actions"`);
  }
}
