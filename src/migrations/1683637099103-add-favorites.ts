import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1683637099103 implements MigrationInterface {
  name = 'add-favorites-1683637099103';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "item_favorite" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "member_id" uuid NOT NULL, "item_id" uuid NOT NULL, CONSTRAINT "favorite_key" UNIQUE ("member_id", "item_id"), CONSTRAINT "PK_495675cec4fb09666704e4f610f" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'ALTER TABLE "item_favorite" ADD CONSTRAINT "FK_a169d350392956511697f7e7d38" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "item_favorite" ADD CONSTRAINT "FK_10ea93bde287762010695378f94" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE',
    );

    // Backfill old favorites
    // Also checks that the favorite item id is actually an existing item to prevent foreign key constraint error when inserting
    await queryRunner.query(`INSERT INTO "item_favorite" (member_id, item_id)
            SELECT m.id, uuid(f#>>'{}') AS item_id FROM "member" m, jsonb_array_elements(m.extra::jsonb->'favoriteItems') f(favorite)
            WHERE EXISTS (SELECT id FROM item WHERE item.id = uuid(f#>>'{}'))
            ON CONFLICT DO NOTHING`);
    // Remove the favoriteItem field from extra for everyone
    await queryRunner.query(
      "UPDATE \"member\" SET extra = (extra::jsonb - 'favoriteItems')#>>'{}'",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "item_favorite" DROP CONSTRAINT "FK_10ea93bde287762010695378f94"',
    );
    await queryRunner.query(
      'ALTER TABLE "item_favorite" DROP CONSTRAINT "FK_a169d350392956511697f7e7d38"',
    );
    await queryRunner.query('DROP TABLE "item_favorite"');
  }
}
