import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1727167973931 implements MigrationInterface {
  name = 'migrate-guest-account-1727167973931';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update the old guest account that has not been migrated yet.
    await queryRunner.query(
      `
    UPDATE account
    SET 
        type = 'guest', -- Set the account type to guest
        email = NULL,  -- Remove the email
        is_validated = false,
        item_login_schema_id = item_login_schema.id 
    
    FROM item_membership -- Join on Item Membership
        INNER JOIN item_login_schema  -- Join on Item Login Schema
            ON item_login_schema.item_path = item_membership.item_path
    WHERE item_membership.account_id = account.id 
    AND account.email ~* '^[0-9a-f]{4}-[0-9]{10,}@graasp.org'  -- If the email has the Old Guest Account Format
    AND account.type = 'individual' -- If the account is still an individual account
    AND (
      item_membership.account_id = item_membership.creator_id -- If the creator is himself
      OR item_membership.creator_id = '12345678-1234-1234-1234-123456789012' -- Or is Graasper / The System Account
    )
        `,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
