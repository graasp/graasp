import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1718177442134 implements MigrationInterface {
  name = 'item-order-1718177442134';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item" ADD "order" numeric DEFAULT NULL`);

    // get childrenOrder in extra and fill the corresponding order
    await queryRunner.query(`
      with childrenIdx as (
        select REPLACE(value::text, '"','')::uuid as id,ordinality from item cross join jsonb_array_elements(((extra::jsonb->'folder')->'childrenOrder')) with ORDINALITY
      )
      update item set "order"=childrenIdx.ordinality*20 from item as it2 inner join childrenIdx on it2.id = childrenIdx.id where item.id=it2.id`);

    // set order for null order (items that are not in childrenOrder or parent does not have order)
    await queryRunner.query(`
      -- ordinality per null item for parent, ordered by created within a parent
      WITH order_in_parent AS (
        SELECT unnest(ARRAY_AGG("id" order by created_at)), subpath(path, 0,-1) AS parent 
        FROM item 
        WHERE "order" IS NULL 
          AND path ~ '*{2,}' 
        GROUP BY parent
      ),
      -- last order value per parent
      last_order_in_parent AS (
        SELECT (CASE WHEN MAX("order") IS NULL THEN 20 ELSE max("order") END) AS last_order, subpath(path, 0,-1) AS parent 
        FROM item 
        GROUP BY parent
      ),
      -- define new order value given position within parent and last order value within parent
      new_order_values AS (
        SELECT (ROW_NUMBER() OVER (ORDER BY created_at)) + last_order AS new_order, "order", last_order, id, path, created_at 
        FROM order_in_parent 
        LEFT JOIN item 
          ON item.id = order_in_parent.unnest 
        LEFT JOIN last_order_in_parent 
          ON last_order_in_parent.parent = order_in_parent.parent)
      -- update null only
      UPDATE item i 
      SET "order"=new_order_values.new_order 
      FROM new_order_values 
      WHERE new_order_values.id = i.id 
        AND i.order IS NULL
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "order"`);
  }
}
