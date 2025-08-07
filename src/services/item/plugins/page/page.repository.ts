import { and, asc, desc, eq, gte, lt } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../drizzle/db';
import { pageUpdateTable } from '../../../../drizzle/schema';

@singleton()
export class PageRepository {
  async createUpdate(
    dbConnection: DBConnection,
    itemId: string,
    clock: number,
    update: Uint8Array,
  ): Promise<void> {
    await dbConnection.insert(pageUpdateTable).values({ update, clock, itemId });
  }

  /**
   * Get latest update clock for page id
   * @param dbConnection database connection
   * @param itemId
   * @returns latest update clock
   */
  async getCurrentUpdateClock(dbConnection: DBConnection, itemId: string): Promise<number> {
    const lastUpdate = await dbConnection.query.pageUpdateTable.findFirst({
      columns: { clock: true },
      where: eq(pageUpdateTable.itemId, itemId),
      orderBy: desc(pageUpdateTable.clock),
    });
    return lastUpdate ? lastUpdate.clock : -1;
  }

  /**
   * Get all document updates for a specific document.
   */
  async getUpdates(dbConnection: DBConnection, itemId: string): Promise<Uint8Array[]> {
    const updateEntries = await dbConnection.query.pageUpdateTable.findMany({
      columns: { update: true },
      where: eq(pageUpdateTable.itemId, itemId),
      orderBy: asc(pageUpdateTable.clock),
    });
    return updateEntries.map(({ update }) => update);
  }

  /**
   * Delete updates between from (included) and to (excluded)
   * @param dbConnection database connection
   * @param itemId
   * @param from
   * @param to
   */
  async clearUpdatesRange(
    dbConnection: DBConnection,
    itemId: string,
    from: number,
    to: number,
  ): Promise<void> {
    await dbConnection
      .delete(pageUpdateTable)
      .where(
        and(
          eq(pageUpdateTable.itemId, itemId),
          gte(pageUpdateTable.clock, from),
          lt(pageUpdateTable.clock, to),
        ),
      );
  }
}
