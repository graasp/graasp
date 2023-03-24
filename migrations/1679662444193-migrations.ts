import { MigrationInterface, QueryRunner } from "typeorm";

export class migrations1679662444193 implements MigrationInterface {
    name = 'migrations1679662444193'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_published" DROP CONSTRAINT "FK_490fddd9099ee7ddcccf8c776a1"`);
        await queryRunner.query(`ALTER TABLE "item_published" ADD CONSTRAINT "UQ_490fddd9099ee7ddcccf8c776a1" UNIQUE ("item_path")`);
        await queryRunner.query(`ALTER TABLE "item_tag" ADD CONSTRAINT "item-tag" UNIQUE ("item_path", "type")`);
        await queryRunner.query(`ALTER TABLE "item_published" ADD CONSTRAINT "FK_490fddd9099ee7ddcccf8c776a1" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_published" DROP CONSTRAINT "FK_490fddd9099ee7ddcccf8c776a1"`);
        await queryRunner.query(`ALTER TABLE "item_tag" DROP CONSTRAINT "item-tag"`);
        await queryRunner.query(`ALTER TABLE "item_published" DROP CONSTRAINT "UQ_490fddd9099ee7ddcccf8c776a1"`);
        await queryRunner.query(`ALTER TABLE "item_published" ADD CONSTRAINT "FK_490fddd9099ee7ddcccf8c776a1" FOREIGN KEY ("item_path") REFERENCES "item"("path") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

}
