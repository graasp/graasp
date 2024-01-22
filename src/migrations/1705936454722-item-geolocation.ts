import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1705936454722 implements MigrationInterface {
  name = 'item-geolocation-1705936454722';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "item_geolocation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "lat" double precision NOT NULL, "lng" double precision NOT NULL, "country" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "item_path" ltree NOT NULL, CONSTRAINT "item_geolocation_unique_item" UNIQUE ("item_path"), CONSTRAINT "REL_66d4b13df4e7765068c8268d71" UNIQUE ("item_path"), CONSTRAINT "PK_86f80fb0e15a1df2526d2f69865" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "item_geolocation" ADD CONSTRAINT "FK_66d4b13df4e7765068c8268d719" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "item_geolocation" DROP CONSTRAINT "FK_66d4b13df4e7765068c8268d719"`,
    );
    await queryRunner.query(`DROP TABLE "item_geolocation"`);
  }
}
