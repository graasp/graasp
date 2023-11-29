import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1701250306959 implements MigrationInterface {
  name = 'member-profile-1701250306959';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "member_profile" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "bio" character varying(5000), "visibility" boolean NOT NULL DEFAULT false, "facebookID" character varying(100), "linkedinID" character varying(100), "twitterID" character varying(100), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "member_id" uuid, CONSTRAINT "member-profile" UNIQUE ("member_id"), CONSTRAINT "REL_91fa43bc5482dc6b00892baf01" UNIQUE ("member_id"), CONSTRAINT "PK_157ca6e25e9cbd657a2302fb12d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_91fa43bc5482dc6b00892baf01" ON "member_profile" ("member_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "member_profile" ADD CONSTRAINT "FK_91fa43bc5482dc6b00892baf016" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "member_profile" DROP CONSTRAINT "FK_91fa43bc5482dc6b00892baf016"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_91fa43bc5482dc6b00892baf01"`);
    await queryRunner.query(`DROP TABLE "member_profile"`);
  }
}
