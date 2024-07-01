import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1718693920666 implements MigrationInterface {
  name = 'Migrations1718693920666';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "member" ADD "last_authenticated_at" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE "member" ADD "is_validated" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "member" DROP COLUMN "last_authenticated_at"`);
    await queryRunner.query(`ALTER TABLE "member" DROP COLUMN "is_validated"`);
  }
}
