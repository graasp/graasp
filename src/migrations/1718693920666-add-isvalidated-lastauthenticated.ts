import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1718693920666 implements MigrationInterface {
  name = 'is-validated-1718693920666';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "member" ADD "last_authenticated_at" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE "member" ADD "is_validated" boolean NOT NULL DEFAULT true`,
    );
    // pseudonized members will also be validated, but this will disappear in next migrations
    await queryRunner.query(`ALTER TABLE "member" ALTER COLUMN "is_validated" SET DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "member" DROP COLUMN "last_authenticated_at"`);
    await queryRunner.query(`ALTER TABLE "member" DROP COLUMN "is_validated"`);
  }
}
