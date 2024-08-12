import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1723018735439 implements MigrationInterface {
  name = 'membership-request-1723018735439';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "membership_request" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "member_id" uuid NOT NULL, "item_id" uuid NOT NULL, CONSTRAINT "UQ_membership_request_item-member" UNIQUE ("item_id", "member_id"), CONSTRAINT "PK_ab282071990a6efd6967ec4111f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "membership_request" ADD CONSTRAINT "FK_membership_request_member_id" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "membership_request" ADD CONSTRAINT "FK_membership_request_item_id" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "membership_request" DROP CONSTRAINT "FK_membership_request_item_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "membership_request" DROP CONSTRAINT "FK_membership_request_member_id"`,
    );
    await queryRunner.query(`DROP TABLE "membership_request"`);
  }
}
