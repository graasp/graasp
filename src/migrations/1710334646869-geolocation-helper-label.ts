import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1710334646869 implements MigrationInterface {
  name = 'geolocation-helper-label-1710334646869';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "item_geolocation" ADD "helperLabel" character varying(300)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item_geolocation" DROP COLUMN "helperLabel"`);
  }
}
