import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1712241391870 implements MigrationInterface {
  name = 'enable-save-actions-1712241391870';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "member" ADD "enable_save_actions" boolean`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "member" DROP COLUMN "enable_save_actions"`);
  }
}
