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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // assume we only had one file storage type in the whole db
    await queryRunner.query(` 
        UPDATE item
        SET type = 's3File',
        extra = CONCAT('{"s3File":', extra::jsonb->>'file', '}')
        WHERE type = 'file' 
    `);
  }
}
