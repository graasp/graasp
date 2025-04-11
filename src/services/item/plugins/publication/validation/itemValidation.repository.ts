import { eq } from 'drizzle-orm';

import { ItemValidationProcess, ItemValidationStatus } from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { itemValidationsTable } from '../../../../../drizzle/schema';
import { ItemValidationRaw } from '../../../../../drizzle/types';

export class ItemValidationRepository {
  /**
   * Create an entry for the validation attempt in item-validation
   * @param {string} itemId id of the item being validated
   */
  async post(
    dbConnection: DBConnection,
    itemId: string,
    itemValidationGroupId: string,
    process: ItemValidationProcess,
    status = ItemValidationStatus.Pending,
  ): Promise<{ id: ItemValidationRaw['id'] }> {
    const res = await dbConnection
      .insert(itemValidationsTable)
      .values({
        itemId,
        itemValidationGroupId,
        process,
        status,
      })
      .returning({ id: itemValidationsTable.id });
    return res[0];
  }

  async patch(
    dbConnection: DBConnection,
    itemValidationId: string,
    args: { result?: string; status: ItemValidationStatus },
  ): Promise<void> {
    await dbConnection
      .update(itemValidationsTable)
      .set(args)
      .where(eq(itemValidationsTable.id, itemValidationId));
  }
}
