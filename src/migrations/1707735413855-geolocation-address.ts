import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1707735413855 implements MigrationInterface {
  name = 'geolocation-address-1707735413855';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "item_geolocation" ADD "addressLabel" character varying(300)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item_geolocation" DROP COLUMN "addressLabel"`);
  }
}
