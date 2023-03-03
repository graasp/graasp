
module.exports = class PostRefactoring1668007545726 {
    name = 'PostRefactoring1668007545726';

    async up(queryRunner) {
        await queryRunner.query('CREATE TABLE "member" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "email" character varying(100) NOT NULL, "type" character varying NOT NULL DEFAULT \'individual\', "extra" text NOT NULL DEFAULT \'{}\', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_4678079964ab375b2b31849456c" UNIQUE ("email"), CONSTRAINT "id" UNIQUE ("id"), CONSTRAINT "PK_97cbbe986ce9d14ca5894fdc072" PRIMARY KEY ("id"))');
        await queryRunner.query('CREATE TABLE "item" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "description" character varying(100), "type" character varying NOT NULL DEFAULT \'folder\', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "extra" text NOT NULL, "settings" text NOT NULL DEFAULT \'{}\', "mpath" character varying DEFAULT \'\', "creatorId" uuid, "parentId" uuid, CONSTRAINT "id" UNIQUE ("id"), CONSTRAINT "PK_d3c0c71f23e7adcf952a1d13423" PRIMARY KEY ("id"))');
        await queryRunner.query('CREATE TABLE "item_membership" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "permission" character varying(100) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "creatorId" uuid, "memberId" uuid, "itemId" uuid, CONSTRAINT "item-member" UNIQUE ("itemId", "memberId"), CONSTRAINT "PK_4697b5e1247909f5c884cc12ec3" PRIMARY KEY ("id"))');
        await queryRunner.query('CREATE TABLE "member_password" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "password" character varying(100) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "memberId" uuid, CONSTRAINT "member-password" UNIQUE ("memberId"), CONSTRAINT "REL_a2f90052cc8c2b5715e980a8af" UNIQUE ("memberId"), CONSTRAINT "PK_ff1a1183c81e78eaaa038f05a35" PRIMARY KEY ("id"))');
        await queryRunner.query('ALTER TABLE "item" ADD CONSTRAINT "FK_5cb1e9efcd5e18e045f84019126" FOREIGN KEY ("creatorId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION');
        await queryRunner.query('ALTER TABLE "item" ADD CONSTRAINT "FK_2e3b654a1f669d356e259e7ca3c" FOREIGN KEY ("parentId") REFERENCES "item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION');
        await queryRunner.query('ALTER TABLE "item_membership" ADD CONSTRAINT "FK_c6b0881f2ccbd7aee2a9d5ae9f8" FOREIGN KEY ("creatorId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION');
        await queryRunner.query('ALTER TABLE "item_membership" ADD CONSTRAINT "FK_c28d5aac1a2942fe0c6ace9ffa3" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION');
        await queryRunner.query('ALTER TABLE "item_membership" ADD CONSTRAINT "FK_ad43ef8547d37274ec04e60949a" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION');
        await queryRunner.query('ALTER TABLE "member_password" ADD CONSTRAINT "FK_a2f90052cc8c2b5715e980a8afc" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION');
    }

    async down(queryRunner) {
        await queryRunner.query('ALTER TABLE "member_password" DROP CONSTRAINT "FK_a2f90052cc8c2b5715e980a8afc"');
        await queryRunner.query('ALTER TABLE "item_membership" DROP CONSTRAINT "FK_ad43ef8547d37274ec04e60949a"');
        await queryRunner.query('ALTER TABLE "item_membership" DROP CONSTRAINT "FK_c28d5aac1a2942fe0c6ace9ffa3"');
        await queryRunner.query('ALTER TABLE "item_membership" DROP CONSTRAINT "FK_c6b0881f2ccbd7aee2a9d5ae9f8"');
        await queryRunner.query('ALTER TABLE "item" DROP CONSTRAINT "FK_2e3b654a1f669d356e259e7ca3c"');
        await queryRunner.query('ALTER TABLE "item" DROP CONSTRAINT "FK_5cb1e9efcd5e18e045f84019126"');
        await queryRunner.query('DROP TABLE "member_password"');
        await queryRunner.query('DROP TABLE "item_membership"');
        await queryRunner.query('DROP TABLE "item"');
        await queryRunner.query('DROP TABLE "member"');
    }
};
