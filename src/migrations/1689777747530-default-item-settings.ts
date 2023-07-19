import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1689777747530 implements MigrationInterface {
    name = 'Migrations1689777747530'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item" ALTER COLUMN "settings" DROP DEFAULT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item" ALTER COLUMN "settings" SET DEFAULT '{}'`);
    }

}
