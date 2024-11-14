import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1731589137582 implements MigrationInterface {
  name = 'tag-name-length-1731589137582';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tag ALTER COLUMN name TYPE VARCHAR (255);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tag ALTER COLUMN name TYPE VARCHAR;`);
  }
}
