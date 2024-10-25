import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1729857146775 implements MigrationInterface {
  name = 'language-category-to-item-1729857146775';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // we ignore english category
    for (const [lang, key] of [
      ['french', 'fr'],
      ['german', 'de'],
      ['arabic', 'ar'],
      ['italian', 'it'],
    ]) {
      // change item lang based on category lang
      await queryRunner.query(
        `update item set lang='${key}' 
        where path IN (select item_path from item_category left join category on category_id = category.id  where category.name = '${lang}' )`,
      );

      // remove language category from db
      // cascade delete relatede item_category
      await queryRunner.query(`DELETE category where type ='language'`);
    }
  }

  public async down(): Promise<void> {}
}
