import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1727167973931 implements MigrationInterface {
  name = 'migrate-guest-account-1727167973931';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update the old guest account that has not been migrated yet.
    await queryRunner.query(
      `
UPDATE 
    account
SET 
    type = 'guest', -- Set the account type to guest
    email = NULL,  -- Remove the email
    is_validated = false,
    item_login_schema_id = item_login_schema.id 
FROM  -- Join on Item Membership
    item_membership
INNER JOIN -- Join on Item Login Schema
    item_login_schema ON item_login_schema.item_path = item_membership.item_path
WHERE 
    item_membership.account_id = account.id -- Complete join on Item Membership

    -- In case of duplicate, we need to only migrate the most recent account
    -- Because there is an unique constraint on the combination of name and item_login_schema_id when type is 'guest'
    AND account.id IN ( -- Check if the id is in the list of account we have to migrate
        SELECT 
            id 
        FROM ( -- Second encapsulation here, so I add a filter on the row_number
            SELECT 
                account.id,

                -- row_number is the rank of the combination account.name and item_login_schema.id when ordered by updated_at
                ROW_NUMBER() OVER (PARTITION BY account.name, item_login_schema.id ORDER BY account.updated_at DESC) AS row_number
            FROM 
                item_membership
            INNER JOIN 
                item_login_schema ON item_login_schema.item_path = item_membership.item_path
            INNER JOIN 
                account ON account.id = item_membership.account_id
            WHERE 
                account.email ~* '^[0-9a-f]{4}-[0-9]{10,}@graasp.org' -- Verify if the email matches the Pseudonymized Graasp Email format
                AND account.type = 'individual' -- Filter on account that has not been migrated yet
                AND (
                    item_membership.account_id = item_membership.creator_id -- If the creator is himself
                    OR item_membership.creator_id = '12345678-1234-1234-1234-123456789012' -- Or is Graasper / The System Account
                )
        ) AS sub
        WHERE row_number = 1
    );
        `,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Down migration is not possible, it should be done on account-single-table-inheritance-1724225602329
  }
}
