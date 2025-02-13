import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1739199074756 implements MigrationInterface {
  name = 'only-file-type-1739199074756';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(` 
        UPDATE item
        SET type = 'file',
        extra = CONCAT('{"file":', extra::jsonb->>'s3File', '}')
        WHERE type = 's3File' 
    `);

    await queryRunner.query(` 
        UPDATE app_data
        SET data = CONCAT('{"file":', data::jsonb->>'s3File', '}')
        WHERE type = 'file' 
    `);

    await queryRunner.query(` 
        UPDATE app_setting
        SET data = CONCAT('{"file":', data::jsonb->>'s3File', '}')
        WHERE data::jsonb->>'s3File' IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // assume we only had one file storage type in the whole db
    await queryRunner.query(` 
        UPDATE item
        SET type = 's3File',
        extra = CONCAT('{"s3File":', extra::jsonb->>'file', '}')
        WHERE type = 'file' 
    `);

    await queryRunner.query(` 
        UPDATE app_data
        SET data = CONCAT('{"s3file":', data::jsonb->>'file', '}')
        WHERE type = 'file' 
    `);

    await queryRunner.query(` 
        UPDATE app_setting
        SET data = CONCAT('{"s3file":', data::jsonb->>'file', '}')
        WHERE data::jsonb->>'file' IS NOT NULL
    `);
  }
}
