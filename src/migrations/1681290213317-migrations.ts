import { MigrationInterface, QueryRunner } from 'typeorm';

export class migrations1681290213317 implements MigrationInterface {
  name = 'migrations1681290213317';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "action" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "view" character varying NOT NULL, "type" character varying NOT NULL, "extra" text NOT NULL, "geolocation" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "member_id" uuid, "item_path" ltree, CONSTRAINT "PK_2d9db9cf5edfbbae74eb56e3a39" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "action_request_export" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "member_id" uuid NOT NULL, "item_path" ltree, CONSTRAINT "PK_cce524d4aa89d5a2e8eff55f980" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "action" ADD CONSTRAINT "FK_266df04a901f13e3c666504a0fb" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "action" ADD CONSTRAINT "FK_d1e204f54e77573838087f3c153" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_request_export" ADD CONSTRAINT "FK_bc85ef3298df8c7974b33081b47" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_request_export" ADD CONSTRAINT "FK_fea823c4374f507a68cf8f926a4" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action_request_export" DROP CONSTRAINT "FK_fea823c4374f507a68cf8f926a4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_request_export" DROP CONSTRAINT "FK_bc85ef3298df8c7974b33081b47"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action" DROP CONSTRAINT "FK_d1e204f54e77573838087f3c153"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action" DROP CONSTRAINT "FK_266df04a901f13e3c666504a0fb"`,
    );
    await queryRunner.query(`DROP TABLE "action_request_export"`);
    await queryRunner.query(`DROP TABLE "action"`);
  }
}
