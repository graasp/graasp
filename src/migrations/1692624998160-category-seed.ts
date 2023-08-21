import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1692624998160 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const update = async (name: string, newName: string) => {
      await queryRunner.query(`
            UPDATE category
            SET name='${newName}'
            WHERE name='${name}'
        `);
    };

    await update('English', 'english');
    await update('French', 'french');
    await update('German', 'german');

    // add new languages
    await queryRunner.query(`INSERT INTO category (name, type) VALUES (
        'arabic',
        'language'
        );
    `);
    await queryRunner.query(`INSERT INTO category (name, type) VALUES (
        'italian',
        'language'
        );
    `);

    // // add categories for discipline
    await update('Arts', 'arts');
    await update('Language', 'language');
    await update('Math', 'mathematics');
    await update('Literature', 'literature');
    await update('Natural Science', 'natural-science');
    await update('Social Science', 'social-science');

    // // add categories for level
    await update('Kindergarden', 'kindergarten');
    await update('Primary School', 'primary-school');
    await update('Lower Secondary School', 'lower-secondary-education');
    await update('Upper Secondary School', 'upper-secondary-education');
    await update('Higher Education', 'higher-education');
    await update('Vocational Training', 'vocation-training');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM category WHERE name = 'arabic'`);
    await queryRunner.query(`DELETE FROM category WHERE name = 'italian'`);

    await queryRunner.query(`UPDATE FROM category SET name='Arts' WHERE name = 'arts'`);
    await queryRunner.query(`UPDATE FROM category SET name='Language' WHERE name = 'language'`);
    await queryRunner.query(`UPDATE FROM category SET name='Math' WHERE name = 'mathematics'`);
    await queryRunner.query(`UPDATE FROM category SET name='Literature' WHERE name = 'literature'`);
    await queryRunner.query(
      `UPDATE FROM category SET name='Natural Science' WHERE name = 'natural-science'`,
    );
    await queryRunner.query(
      `UPDATE FROM category SET name='Social Science' WHERE name = 'social-science'`,
    );

    // // add categories for level
    await queryRunner.query(
      `UPDATE FROM category SET name='Kindergarten' WHERE name = 'kindergarten'`,
    );
    await queryRunner.query(
      `UPDATE FROM category SET name='Primary School' WHERE name = 'primary-school'`,
    );
    await queryRunner.query(
      `UPDATE FROM category SET name='Lower Secondary Education' WHERE name = 'lower-secondary-education'`,
    );
    await queryRunner.query(
      `UPDATE FROM category SET name='Upper Secondary Education' WHERE name = 'upper-secondary-education'`,
    );
    await queryRunner.query(
      `UPDATE FROM category SET name='Higher Education' WHERE name = 'higher-education'`,
    );
    await queryRunner.query(
      `UPDATE FROM category SET name='Vocational Training' WHERE name = 'vocation-training'`,
    );
  }
}
