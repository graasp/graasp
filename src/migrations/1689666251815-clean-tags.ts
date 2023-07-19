import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1689666251815 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // remove duplicate tag public-item that remains alongside a public tag
    // induced before this migration
    await queryRunner.query(`
        DELETE
        FROM item_tag AS t1
        WHERE t1.type = 'public-item' AND
        EXISTS (SELECT 1 FROM item_tag AS t2 WHERE t2.item_path = t1.item_path AND t2.type = 'public');
      `);

    // rename public tag
    await queryRunner.query(`UPDATE "item_tag" 
        SET type = 'public'
        WHERE type = 'public-item' 
        `);

    // remove published tag since it's in another table
    await queryRunner.query(`DELETE FROM "item_tag" 
        WHERE type = 'published-item' 
        `);

    // remove item login tag since it's in another table
    await queryRunner.query(`DELETE FROM "item_tag" 
        WHERE type = 'item-login' 
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // rename public tag
    await queryRunner.query(`UPDATE "item_tag" 
        SET type = 'public-item'
        WHERE type = 'public' 
        `);
  }
}
