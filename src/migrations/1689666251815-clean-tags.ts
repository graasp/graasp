import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1689666251815 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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
