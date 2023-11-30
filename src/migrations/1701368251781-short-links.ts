import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1701368251781 implements MigrationInterface {
  name = 'short-links-1701368251781';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."short_link_platform_enum" AS ENUM('builder', 'player', 'library')`,
    );
    await queryRunner.query(
      `CREATE TABLE "short_link" ("alias" character varying(255) NOT NULL, "platform" "public"."short_link_platform_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(), "item_id" uuid NOT NULL, CONSTRAINT "CHK_200ef28b2168aaf1e36b6896fc" CHECK (LENGTH(alias) >= 6 AND LENGTH(alias) <= 255 AND alias ~ '^[a-zA-Z0-9-]*$'), CONSTRAINT "PK_9adc7fa5e363de1e6bf79195f92" PRIMARY KEY ("alias"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_43c8a0471d5e58f99fc9c36b99" ON "short_link" ("item_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "short_link" ADD CONSTRAINT "FK_43c8a0471d5e58f99fc9c36b991" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "short_link" ADD CONSTRAINT "UQ_859a3384cadaa460b84e04e5375" UNIQUE ("item_id", "platform")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "short_link" DROP CONSTRAINT "FK_43c8a0471d5e58f99fc9c36b991"`,
    );
    await queryRunner.query(
      `ALTER TABLE "short_link" DROP CONSTRAINT "UQ_859a3384cadaa460b84e04e5375"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_43c8a0471d5e58f99fc9c36b99"`);
    await queryRunner.query(`DROP TABLE "short_link"`);
    await queryRunner.query(`DROP TYPE "public"."short_link_platform_enum"`);
  }
}
