import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1734623784243 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        UPDATE item_membership 
        SET permission = 'read' 
        WHERE id in (
            SELECT item_membership.id 
            FROM item_membership 
            INNER JOIN account ON 
                account_id = account.id 
                AND account.type = 'guest' 
            WHERE 
                permission = 'write' 
                OR permission = 'admin' 
            ORDER BY account.updated_at DESC
        )
            `);
  }

  public async down(_: QueryRunner): Promise<void> {
    // impossible to down
  }
}
