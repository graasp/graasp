const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class PostRefactoring1667491504414 {
    name = 'PostRefactoring1667491504414'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "item_membership" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "permission" character varying(100) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "creatorId" uuid, "memberId" uuid, "itemId" uuid, CONSTRAINT "item-member" UNIQUE ("itemId", "memberId"), CONSTRAINT "PK_4697b5e1247909f5c884cc12ec3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "member_password" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "password" character varying(100) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "memberId" uuid, CONSTRAINT "member-password" UNIQUE ("memberId"), CONSTRAINT "REL_a2f90052cc8c2b5715e980a8af" UNIQUE ("memberId"), CONSTRAINT "PK_ff1a1183c81e78eaaa038f05a35" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "item" ADD "extra" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item" ADD "settings" text NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "item" ADD "creatorId" uuid`);
        await queryRunner.query(`ALTER TABLE "item" ADD CONSTRAINT "FK_5cb1e9efcd5e18e045f84019126" FOREIGN KEY ("creatorId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_membership" ADD CONSTRAINT "FK_c6b0881f2ccbd7aee2a9d5ae9f8" FOREIGN KEY ("creatorId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_membership" ADD CONSTRAINT "FK_c28d5aac1a2942fe0c6ace9ffa3" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_membership" ADD CONSTRAINT "FK_ad43ef8547d37274ec04e60949a" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "member_password" ADD CONSTRAINT "FK_a2f90052cc8c2b5715e980a8afc" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "member_password" DROP CONSTRAINT "FK_a2f90052cc8c2b5715e980a8afc"`);
        await queryRunner.query(`ALTER TABLE "item_membership" DROP CONSTRAINT "FK_ad43ef8547d37274ec04e60949a"`);
        await queryRunner.query(`ALTER TABLE "item_membership" DROP CONSTRAINT "FK_c28d5aac1a2942fe0c6ace9ffa3"`);
        await queryRunner.query(`ALTER TABLE "item_membership" DROP CONSTRAINT "FK_c6b0881f2ccbd7aee2a9d5ae9f8"`);
        await queryRunner.query(`ALTER TABLE "item" DROP CONSTRAINT "FK_5cb1e9efcd5e18e045f84019126"`);
        await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "creatorId"`);
        await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "settings"`);
        await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "extra"`);
        await queryRunner.query(`DROP TABLE "member_password"`);
        await queryRunner.query(`DROP TABLE "item_membership"`);
    }
}
