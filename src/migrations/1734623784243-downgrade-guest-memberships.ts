import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1734623784243 implements MigrationInterface {
  name = 'downgrade-guest-memberships-1734623784243';

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
        )
    `);
  }

  public async down(_: QueryRunner): Promise<void> {
    // impossible to revert
  }
}
