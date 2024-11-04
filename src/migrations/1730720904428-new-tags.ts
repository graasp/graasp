import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1730720904428 implements MigrationInterface {
  name = 'new-tags-1730720904428';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."tag_type_enum" AS ENUM('level', 'discipline', 'resource-type')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tag" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "type" "public"."tag_type_enum" NOT NULL, CONSTRAINT "tag-name-type" UNIQUE ("name", "type"), CONSTRAINT "PK_8e4052373c579afc1471f526760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "item_to_tag" ("tag_id" uuid NOT NULL, "item_id" uuid NOT NULL, CONSTRAINT "UQ_item_tag" UNIQUE ("item_id", "tag_id"), CONSTRAINT "PK_a04bb2298e37d95233a0c92347e" PRIMARY KEY ("tag_id", "item_id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_item_to_tag_item" ON "item_to_tag" ("item_id") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_item_to_tag_item"`);
    await queryRunner.query(`DROP TABLE "item_to_tag"`);
    await queryRunner.query(`DROP TABLE "tag"`);
    await queryRunner.query(`DROP TYPE "public"."tag_type_enum"`);
  }
}
