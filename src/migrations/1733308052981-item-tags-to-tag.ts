import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1733308052981 implements MigrationInterface {
  name = 'item-tags-to-tag-1733308052981';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // insert distinct tags
    await queryRunner.query(`
        insert into tag (name, category)
        select DISTINCT(
            trim(
                -- replace faulty breaking lines into spaces
                replace(
                    unnest(
                        -- break comma-separated tags into multiple tags 
                        string_to_array(
                            -- remove resulting quotes (") 
                            substr(
                                jsonb_array_elements(settings::jsonb->'tags')::text,
                                2,
                                length(jsonb_array_elements( settings::jsonb->'tags' )::text) - 2
                            ),','
                        )
                    ),'\n',' '
                )
            )
        ), 'discipline'::tag_category_enum from item

        where settings::jsonb->'tags' is not null 
        `);

    // insert item_tag relation
    await queryRunner.query(`
        insert into item_tag (tag_id, item_id)
        select  tag.id, iid from (
        -- get all items and their corresponding tag entries
        select item.id as iid,  trim(
                replace(
                    unnest(
                        string_to_array(
                            substr(
                                jsonb_array_elements(settings::jsonb->'tags')::text,
                                2,
                                length(jsonb_array_elements( settings::jsonb->'tags' )::text) - 2
                                ),','
                            )
                        ),'\n',' '
                    )
                ) as t
            from item 
        
        where settings::jsonb->'tags' is not null 
        
        ) as tags
        left join tag on tags.t = tag.name
        `);

    // manually migrate existing disciplines to level and resource type tags to populate
    for (const [category, tags] of [
      [
        'level',
        [
          '2º BACH',
          '3 ESO',
          '4. Klasse',
          '5º curso',
          '7. Klasse',
          'A1 ELE',
          'B1',
          'CDD course. B2',
          'collège',
          'ELE. A1.',
          'formación profesional',
          'Lehrplan 21',
          'MA.2.A.1.i',
          'MA.2.C.2.h',
          'Sek1',
          'Sekundarstufe 1',
        ],
      ],
      [
        'resource-type',
        [
          'app',
          'Audio',
          'Demo',
          'FAQ',
          'Formation',
          'formulaire',
          'image',
          'Lesen',
          'OER',
          'picture',
          'podcast',
          'Recording',
          'Template',
          'text',
          'texte',
          'Transcription',
          'tutorial',
          'Tutorial',
          'video',
        ],
      ],
    ]) {
      for (const tag of tags) {
        // add tag in another category
        await queryRunner.query(`
            INSERT INTO tag (name, category) values ('${tag}', '${category}'::tag_category_enum)`);

        // update item tag entry with new tag
        await queryRunner.query(`
            update item_tag 
            set tag_id = (select id from tag where tag.name = '${tag}' and tag.category = '${category}')
            where tag_id IN (
                select tag_id from item_tag 
                inner join tag on tag.name = '${tag}' and tag.id = item_tag.tag_id
                where tag.name  = '${tag}'
            )
            `);

        // remove tag from discipline category
        await queryRunner.query(`
            delete from tag where tag.name = '${tag}' and category='discipline'
            `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM tag;`);
    await queryRunner.query(`DELETE FROM item_tag;`);
  }
}
