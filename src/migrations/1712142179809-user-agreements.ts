import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1712142179809 implements MigrationInterface {
  name = 'user-agreements-1712142179809';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "member" ADD "user_agreements_date" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "member" DROP COLUMN "user_agreements_date"`);
  }
}
