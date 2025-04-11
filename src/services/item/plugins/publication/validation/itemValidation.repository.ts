import { eq } from 'drizzle-orm';

import { ItemValidationProcess, ItemValidationStatus } from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { itemValidationsTable } from '../../../../../drizzle/schema';
import { ItemValidationRaw } from '../../../../../drizzle/types';
import { ItemValidationGroupNotFound, ItemValidationNotFound } from './errors';

export class ItemValidationRepository {
  async get(dbConnection: DBConnection, id: string): Promise<ItemValidationRaw> {
    // additional check that id is not null
    // o/w empty parameter to findOneBy return the first entry
    if (!id) {
      throw new ItemValidationNotFound(id);
    }
    const result = await dbConnection.query.itemValidationsTable.findFirst({
      where: eq(itemValidationsTable.id, id),
    });
    if (!result) {
      throw new ItemValidationNotFound(id);
    }
    return result;
  }

  async getForGroup(dbConnection: DBConnection, groupId: string): Promise<ItemValidationRaw[]> {
    if (!groupId) {
      throw new ItemValidationGroupNotFound(groupId);
    }
    return await dbConnection.query.itemValidationsTable.findMany({
      where: eq(itemValidationsTable.itemValidationGroupId, groupId),
    });
  }

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
