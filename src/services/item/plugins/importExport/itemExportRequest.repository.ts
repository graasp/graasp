import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../drizzle/db';
import { itemRequestExportsTable } from '../../../../drizzle/schema';
import { ItemRequestExportRaw } from '../../../../drizzle/types';

@singleton()
export class ItemRequestExportRepository {
  /**
   * Create given request export and return it.
   * @param requestExport RequestExport to create
   */
  async addOne(
    dbConnection: DBConnection,
    requestExport: Omit<ItemRequestExportRaw, 'id' | 'createdAt'>,
  ): Promise<ItemRequestExportRaw> {
    const { memberId, itemId, type } = requestExport;
    const res = await dbConnection
      .insert(itemRequestExportsTable)
      .values({
        memberId,
        itemId,
        type,
      })
      .returning();
    return res[0];
  }
}
