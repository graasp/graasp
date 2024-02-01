import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1706713997488 implements MigrationInterface {
  name = 'full-text-search-1706713997488';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "item" ADD "lang" character varying NOT NULL DEFAULT 'en'`,
    );
    await queryRunner.query(`ALTER TABLE "item" ADD "search_document" tsvector GENERATED ALWAYS AS ((
      setweight(to_tsvector('simple', name), 'A')  || ' ' ||
      setweight(to_tsvector('english', name), 'A') || ' ' ||
      setweight(to_tsvector('french', name), 'A') || ' ' || (
        case 
            when lang='de' then to_tsvector('german', name) 
            when lang='it' then to_tsvector('italian', name)
            when lang='es' then to_tsvector('spanish', name)
            else ' '
        end) || ' ' ||
      setweight(to_tsvector('english', COALESCE(description,'')), 'B') || ' ' ||
      setweight(to_tsvector('french', COALESCE(description,'')), 'B') || ' ' || (
        case 
            when lang='de' then setweight(to_tsvector('german', COALESCE(description,'')), 'B')
            when lang='it' then setweight(to_tsvector('italian', COALESCE(description,'')), 'B')
            when lang='es' then setweight(to_tsvector('spanish', COALESCE(description,'')), 'B')
            else ' '
        end) || ' ' ||
      setweight(to_tsvector('english', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' ||
      setweight(to_tsvector('french', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' || (
        case 
            when lang='de' then setweight(to_tsvector('german', COALESCE(settings::jsonb->'tags','{}')), 'C')
            when lang='it' then setweight(to_tsvector('italian', COALESCE(settings::jsonb->'tags','{}')), 'C')
            when lang='es' then setweight(to_tsvector('spanish', COALESCE(settings::jsonb->'tags','{}')), 'C')
            else ' '
        end) || ' ' ||
      setweight(to_tsvector('english', COALESCE(replace(extra, '\\u0000', '')::jsonb->'document'->>'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('french', COALESCE(replace(extra, '\\u0000', '')::jsonb->'document'->>'content','{}')), 'D') || ' ' || (
        case 
            when lang='de' then setweight(to_tsvector('german', COALESCE(replace(extra, '\\u0000', '')::jsonb->'document'->>'content','{}')), 'D')
            when lang='it' then setweight(to_tsvector('italian', COALESCE(replace(extra, '\\u0000', '')::jsonb->'document'->>'content','{}')), 'D')
            when lang='es' then setweight(to_tsvector('spanish', COALESCE(replace(extra, '\\u0000', '')::jsonb->'document'->>'content','{}')), 'D')
            else ' '
        end) || ' ' ||
      setweight(to_tsvector('english', COALESCE(replace(extra, '\\u0000', '')::jsonb->'file'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('french', COALESCE(replace(extra, '\\u0000', '')::jsonb->'file'->'content','{}')), 'D') || ' ' || (
        case 
            when lang='de' then setweight(to_tsvector('german', COALESCE(replace(extra, '\\u0000', '')::jsonb->'file'->'content','{}')), 'D')
            when lang='it' then setweight(to_tsvector('italian', COALESCE(replace(extra, '\\u0000', '')::jsonb->'file'->'content','{}')), 'D')
            when lang='es' then setweight(to_tsvector('spanish', COALESCE(replace(extra, '\\u0000', '')::jsonb->'file'->'content','{}')), 'D')
            else ' '
        end) || ' ' ||
      setweight(to_tsvector('english', COALESCE(replace(extra, '\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('french', COALESCE(replace(extra, '\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D') || ' ' || (
        case 
            when lang='de' then setweight(to_tsvector('german', COALESCE(replace(extra, '\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D')
            when lang='it' then setweight(to_tsvector('italian', COALESCE(replace(extra, '\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D')
            when lang='es' then setweight(to_tsvector('spanish', COALESCE(replace(extra, '\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D')
            else ' '
        end)
       ):: tsvector) STORED NOT NULL`);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        process.env.DB_NAME,
        'public',
        'item',
        'GENERATED_COLUMN',
        'search_document',
        "(\n      setweight(to_tsvector('simple', name), 'A')  || ' ' ||\n      setweight(to_tsvector('english', name), 'A') || ' ' ||\n      setweight(to_tsvector('french', name), 'A') || ' ' || (\n        case \n            when lang='de' then to_tsvector('german', name) \n            when lang='it' then to_tsvector('italian', name)\n            when lang='es' then to_tsvector('spanish', name)\n            else ' '\n        end) || ' ' ||\n      setweight(to_tsvector('english', COALESCE(description,'')), 'B') || ' ' ||\n      setweight(to_tsvector('french', COALESCE(description,'')), 'B') || ' ' || (\n        case \n            when lang='de' then setweight(to_tsvector('german', COALESCE(description,'')), 'B')\n            when lang='it' then setweight(to_tsvector('italian', COALESCE(description,'')), 'B')\n            when lang='es' then setweight(to_tsvector('spanish', COALESCE(description,'')), 'B')\n            else ' '\n        end) || ' ' ||\n      setweight(to_tsvector('english', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' ||\n      setweight(to_tsvector('french', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' || (\n        case \n            when lang='de' then setweight(to_tsvector('german', COALESCE(settings::jsonb->'tags','{}')), 'C')\n            when lang='it' then setweight(to_tsvector('italian', COALESCE(settings::jsonb->'tags','{}')), 'C')\n            when lang='es' then setweight(to_tsvector('spanish', COALESCE(settings::jsonb->'tags','{}')), 'C')\n            else ' '\n        end) || ' ' ||\n      setweight(to_tsvector('english', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'document'->>'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('french', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'document'->>'content','{}')), 'D') || ' ' || (\n        case \n            when lang='de' then setweight(to_tsvector('german', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'document'->>'content','{}')), 'D')\n            when lang='it' then setweight(to_tsvector('italian', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'document'->>'content','{}')), 'D')\n            when lang='es' then setweight(to_tsvector('spanish', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'document'->>'content','{}')), 'D')\n            else ' '\n        end) || ' ' ||\n      setweight(to_tsvector('english', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'file'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('french', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'file'->'content','{}')), 'D') || ' ' || (\n        case \n            when lang='de' then setweight(to_tsvector('german', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'file'->'content','{}')), 'D')\n            when lang='it' then setweight(to_tsvector('italian', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'file'->'content','{}')), 'D')\n            when lang='es' then setweight(to_tsvector('spanish', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'file'->'content','{}')), 'D')\n            else ' '\n        end) || ' ' ||\n      setweight(to_tsvector('english', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D') || ' ' ||\n      setweight(to_tsvector('french', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D') || ' ' || (\n        case \n            when lang='de' then setweight(to_tsvector('german', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D')\n            when lang='it' then setweight(to_tsvector('italian', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D')\n            when lang='es' then setweight(to_tsvector('spanish', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D')\n            else ' '\n        end)\n       ):: tsvector",
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
      ['GENERATED_COLUMN', 'search_document', process.env.DB_NAME, 'public', 'item'],
    );
    await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "search_document"`);
  }
}
