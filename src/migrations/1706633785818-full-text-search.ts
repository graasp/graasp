import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1706633785818 implements MigrationInterface {
  name = 'full-item-search-1706633785818';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item" ADD "search_document" tsvector GENERATED ALWAYS AS ((
      setweight(to_tsvector('simple', name), 'A')  || ' ' ||
      setweight(to_tsvector('english', name), 'A') || ' ' ||
      setweight(to_tsvector('french', name), 'A') || ' ' ||
      setweight(to_tsvector('italian', name), 'A') || ' ' ||
      setweight(to_tsvector('german', name), 'A') || ' ' ||
      setweight(to_tsvector('spanish', name), 'A') || ' ' ||
      setweight(to_tsvector('english', COALESCE(description,'')), 'B') || ' ' ||
      setweight(to_tsvector('french', COALESCE(description,'')), 'B') || ' ' ||
      setweight(to_tsvector('italian', COALESCE(description,'')), 'B') || ' ' ||
      setweight(to_tsvector('german', COALESCE(description,'')), 'B') || ' ' ||
      setweight(to_tsvector('spanish', COALESCE(description,'')), 'B') || ' ' ||
      setweight(to_tsvector('english', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' ||
      setweight(to_tsvector('french', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' ||
      setweight(to_tsvector('italian', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' ||
      setweight(to_tsvector('german', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' ||
      setweight(to_tsvector('spanish', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' ||
      setweight(to_tsvector('english', COALESCE(extra::jsonb->'document'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('french', COALESCE(extra::jsonb->'document'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('italian', COALESCE(extra::jsonb->'document'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('german', COALESCE(extra::jsonb->'document'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('spanish', COALESCE(extra::jsonb->'document'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('english', COALESCE(extra::jsonb->'file'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('french', COALESCE(extra::jsonb->'file'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('italian', COALESCE(extra::jsonb->'file'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('german', COALESCE(extra::jsonb->'file'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('spanish', COALESCE(extra::jsonb->'file'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('english', COALESCE(extra::jsonb->'s3File'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('french', COALESCE(extra::jsonb->'s3File'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('italian', COALESCE(extra::jsonb->'s3File'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('german', COALESCE(extra::jsonb->'s3File'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('spanish', COALESCE(extra::jsonb->'s3File'->'content','{}')), 'D')
       ):: tsvector ) STORED NOT NULL`);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'docker',
        'public',
        'item',
        'GENERATED_COLUMN',
        'search_document',
        "(\n      setweight(to_tsvector('simple', name), 'A')  || ' ' ||\n      setweight(to_tsvector('english', name), 'A') || ' ' ||\n      setweight(to_tsvector('french', name), 'A') || ' ' ||\n      setweight(to_tsvector('italian', name), 'A') || ' ' ||\n      setweight(to_tsvector('german', name), 'A') || ' ' ||\n      setweight(to_tsvector('spanish', name), 'A') || ' ' ||\n      setweight(to_tsvector('english', COALESCE(description,'')), 'B') || ' ' ||\n      setweight(to_tsvector('french', COALESCE(description,'')), 'B') || ' ' ||\n      setweight(to_tsvector('italian', COALESCE(description,'')), 'B') || ' ' ||\n      setweight(to_tsvector('german', COALESCE(description,'')), 'B') || ' ' ||\n      setweight(to_tsvector('spanish', COALESCE(description,'')), 'B') || ' ' ||\n      setweight(to_tsvector('english', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' ||\n      setweight(to_tsvector('french', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' ||\n      setweight(to_tsvector('italian', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' ||\n      setweight(to_tsvector('german', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' ||\n      setweight(to_tsvector('spanish', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' ||\n      setweight(to_tsvector('english', COALESCE(extra::jsonb->'document'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('french', COALESCE(extra::jsonb->'document'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('italian', COALESCE(extra::jsonb->'document'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('german', COALESCE(extra::jsonb->'document'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('spanish', COALESCE(extra::jsonb->'document'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('english', COALESCE(extra::jsonb->'file'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('french', COALESCE(extra::jsonb->'file'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('italian', COALESCE(extra::jsonb->'file'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('german', COALESCE(extra::jsonb->'file'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('spanish', COALESCE(extra::jsonb->'file'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('english', COALESCE(extra::jsonb->'s3File'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('french', COALESCE(extra::jsonb->'s3File'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('italian', COALESCE(extra::jsonb->'s3File'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('german', COALESCE(extra::jsonb->'s3File'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('spanish', COALESCE(extra::jsonb->'s3File'->'content','{}')), 'D')\n       ):: tsvector ",
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`,
      ['GENERATED_COLUMN', 'search_document', 'docker', 'public', 'item'],
    );
    await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "search_document"`);
  }
}
