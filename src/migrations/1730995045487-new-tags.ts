import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1730995045487 implements MigrationInterface {
  name = 'new-tags-1730995045487';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."tag_category_enum" AS ENUM('level', 'discipline', 'resource-type')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tag" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "category" "public"."tag_category_enum" NOT NULL, CONSTRAINT "UQ_tag_name_category" UNIQUE ("name", "category"), CONSTRAINT "PK_8e4052373c579afc1471f526760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "item_tag" ("tag_id" uuid NOT NULL, "item_id" uuid NOT NULL, CONSTRAINT "UQ_item_tag" UNIQUE ("item_id", "tag_id"), CONSTRAINT "PK_a04bb2298e37d95233a0c92347e" PRIMARY KEY ("tag_id", "item_id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "item_tag" ADD CONSTRAINT "FK_16ab8afb42f763f7cbaa4bff66a" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "item_tag" ADD CONSTRAINT "FK_39b492fda03c7ac846afe164b58" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_item_tag_item" ON "item_tag" ("item_id") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_item_tag_item"`);
    await queryRunner.query(`DROP TABLE "item_tag"`);
    await queryRunner.query(`DROP TABLE "tag"`);
    await queryRunner.query(`DROP TYPE "public"."tag_category_enum"`);
  }
}
