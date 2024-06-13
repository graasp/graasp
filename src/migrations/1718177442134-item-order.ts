import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1718177442134 implements MigrationInterface {
  name = 'item-order-1718177442134';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item" ADD "order" numeric DEFAULT NULL`);

    await queryRunner.query(`
      with childrenIdx as (
        select REPLACE(value::text, '"','')::uuid as id,ordinality from item cross join jsonb_array_elements(((extra::jsonb->'folder')->'childrenOrder')) with ORDINALITY
      )
      update item set "order"=childrenIdx.ordinality from item as it2 inner join childrenIdx on it2.id = childrenIdx.id where item.id=it2.id`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "order"`);
  }
}
