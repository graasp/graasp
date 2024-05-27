import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1715337878339 implements MigrationInterface {
  name = 'add-foramt-export-actions-1715337878339';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."action_request_export_format_enum" AS ENUM('json', 'csv')`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_request_export" ADD "format" "public"."action_request_export_format_enum" NOT NULL DEFAULT 'json'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "action_request_export" DROP COLUMN "format"`);
    await queryRunner.query(`DROP TYPE "public"."action_request_export_format_enum"`);
  }
}
