import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1729857146775 implements MigrationInterface {
  name = 'language-category-to-item-1729857146775';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // we ignore english category because default item lang is already english
    for (const [lang, key] of [
      ['french', 'fr'],
      ['german', 'de'],
      ['arabic', 'ar'],
      ['italian', 'it'],
    ]) {
      // change item lang based on category lang
      await queryRunner.query(
        `UPDATE item SET lang='${key}' 
        WHERE path IN (
          SELECT item_path FROM item_category 
          LEFT JOIN category ON category_id = category.id
          WHERE category.name = '${lang}'
        )`,
      );

      // remove language category from db
      // cascade delete relatede item_category
      await queryRunner.query(`DELETE FROM category where type='language'`);
    }
  }

  public async down(): Promise<void> {}
}
