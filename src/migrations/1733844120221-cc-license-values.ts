import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1733844120221 implements MigrationInterface {
  name = 'cc-license-values-1733751673963';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // remove ccLicenseAdaption keys for empty values
    await queryRunner.query(
      `update item set settings = settings::jsonb - 'ccLicenseAdaption' where length((settings::jsonb->'ccLicenseAdaption')::text) = 2`,
    );
    // remove deprecated values alike to CC BY-NC-SA
    await queryRunner.query(
      `update item set settings = jsonb_set(settings::jsonb, '{ccLicenseAdaption}'::text[], '"CC BY-NC-SA"'::jsonb) where (settings::jsonb->'ccLicenseAdaption')::text = '"alike"';`,
    );
    // remove deprecated values allow to CC BY-NC
    await queryRunner.query(
      `update item set settings = jsonb_set(settings::jsonb, '{ccLicenseAdaption}'::text[], '"CC BY-NC"'::jsonb) where (settings::jsonb->'ccLicenseAdaption')::text = '"allow"';`,
    );
  }

  public async down(): Promise<void> {}
}
