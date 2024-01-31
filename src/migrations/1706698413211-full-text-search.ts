import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1706698413211 implements MigrationInterface {
  name = 'full-text-search-1706698413211';

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
      setweight(to_tsvector('english', COALESCE(replace(extra, '\\u0000', '')::jsonb->'document'->>'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('french', COALESCE(replace(extra, '\\u0000', '')::jsonb->'document'->>'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('german', COALESCE(replace(extra, '\\u0000', '')::jsonb->'document'->>'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('italian', COALESCE(replace(extra, '\\u0000', '')::jsonb->'document'->>'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('spanish', COALESCE(replace(extra, '\\u0000', '')::jsonb->'document'->>'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('english', COALESCE(replace(extra, '\\u0000', '')::jsonb->'file'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('french', COALESCE(replace(extra, '\\u0000', '')::jsonb->'file'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('italian', COALESCE(replace(extra, '\\u0000', '')::jsonb->'file'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('german', COALESCE(replace(extra, '\\u0000', '')::jsonb->'file'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('spanish', COALESCE(replace(extra, '\\u0000', '')::jsonb->'file'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('english', COALESCE(replace(extra, '\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('french', COALESCE(replace(extra, '\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('italian', COALESCE(replace(extra, '\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('german', COALESCE(replace(extra, '\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('spanish', COALESCE(replace(extra, '\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D')
       ):: tsvector ) STORED NOT NULL`);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'docker',
        'public',
        'item',
        'GENERATED_COLUMN',
        'search_document',
        "(\n      setweight(to_tsvector('simple', name), 'A')  || ' ' ||\n      setweight(to_tsvector('english', name), 'A') || ' ' ||\n      setweight(to_tsvector('french', name), 'A') || ' ' ||\n      setweight(to_tsvector('italian', name), 'A') || ' ' ||\n      setweight(to_tsvector('german', name), 'A') || ' ' ||\n      setweight(to_tsvector('spanish', name), 'A') || ' ' ||\n      setweight(to_tsvector('english', COALESCE(description,'')), 'B') || ' ' ||\n      setweight(to_tsvector('french', COALESCE(description,'')), 'B') || ' ' ||\n      setweight(to_tsvector('italian', COALESCE(description,'')), 'B') || ' ' ||\n      setweight(to_tsvector('german', COALESCE(description,'')), 'B') || ' ' ||\n      setweight(to_tsvector('spanish', COALESCE(description,'')), 'B') || ' ' ||\n      setweight(to_tsvector('english', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' ||\n      setweight(to_tsvector('french', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' ||\n      setweight(to_tsvector('italian', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' ||\n      setweight(to_tsvector('german', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' ||\n      setweight(to_tsvector('spanish', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' ||\n      setweight(to_tsvector('english', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'document'->>'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('french', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'document'->>'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('german', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'document'->>'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('italian', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'document'->>'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('spanish', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'document'->>'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('english', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'file'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('french', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'file'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('italian', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'file'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('german', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'file'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('spanish', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'file'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('english', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('french', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('italian', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('german', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('spanish', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D')\n       ):: tsvector ",
      ],
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_gin_item_search_document" ON "item" USING GIN (search_document)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_gin_item_search_document"`);
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`,
      ['GENERATED_COLUMN', 'search_document', 'docker', 'public', 'item'],
    );
    await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "search_document"`);
  }
}
