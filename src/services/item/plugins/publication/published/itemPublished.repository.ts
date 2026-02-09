import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import type { DBConnection } from '../../../../../drizzle/db';
import { isAncestorOrSelf } from '../../../../../drizzle/operations';
import { items, membersView, publishedItemsTable } from '../../../../../drizzle/schema';
import type {
  ItemPublishedRaw,
  ItemPublishedWithItemWithCreator,
  MemberRaw,
} from '../../../../../drizzle/types';
import type { MinimalMember } from '../../../../../types';
import { type ItemRaw, resolveItemType } from '../../../item';
import { ItemPublishedNotFound } from './errors';

@singleton()
export class ItemPublishedRepository {
  /**
   * Returns inherited published entry for given item
   * @param item
   * @returns published entry if the item is published, null otherwise
   */
  async getForItem(
    dbConnection: DBConnection,
    itemPath: ItemRaw['path'],
  ): Promise<ItemPublishedWithItemWithCreator | null> {
    const res = await dbConnection
      .select()
      .from(publishedItemsTable)
      // .innerJoin(membersView, eq(publishedItems.creatorId, membersView.id))
      .innerJoin(
        items,
        and(
          isAncestorOrSelf(publishedItemsTable.itemPath, itemPath),
          eq(publishedItemsTable.itemPath, items.path),
        ),
      )
      .leftJoin(membersView, eq(items.creatorId, membersView.id))
      .orderBy(desc(sql`nlevel(${publishedItemsTable.itemPath})`))
      .limit(1);

    if (res.length) {
      const entry = res[0];
      const mappedEntry = {
        ...entry.published_items,
        item: { ...resolveItemType(entry.item_view), creator: entry.members_view as MemberRaw },
        // creator: entry.members_view,
      };
      return mappedEntry;
    }
    return null;
  }

  async getForItems(
    dbConnection: DBConnection,
    itemPaths: ItemRaw['path'][],
  ): Promise<ItemPublishedWithItemWithCreator[]> {
    const result = await dbConnection
      .select()
      .from(publishedItemsTable)
      .innerJoin(items, inArray(publishedItemsTable.itemPath, itemPaths))
      .leftJoin(membersView, eq(items.creatorId, membersView.id));

    return result.map(({ published_items, item_view, members_view }) => ({
      item: { ...resolveItemType(item_view), creator: members_view as MemberRaw },
      ...published_items,
    }));
  }

  // Must Implement a proper Paginated<Type> if more complex pagination is needed in the future
  async getPaginatedItems(
    dbConnection: DBConnection,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<[ItemPublishedWithItemWithCreator[], number]> {
    const results = await dbConnection
      .select()
      .from(publishedItemsTable)
      // will ignore soft deleted item
      .innerJoin(items, eq(publishedItemsTable.itemPath, items.path))
      // will ignore null creator id (deleted
      .innerJoin(membersView, eq(items.creatorId, membersView.id))
      .offset((page - 1) * pageSize)
      .limit(pageSize);
    const mappedResults = results.map(({ published_items, item_view, members_view }) => ({
      ...published_items,
      item: { ...resolveItemType(item_view), creator: members_view as MemberRaw },
    }));
    const total = (await dbConnection.select({ count: count() }).from(publishedItemsTable))[0]
      .count;

    return [mappedResults, total];
  }

  async post(dbConnection: DBConnection, creator: MinimalMember, item: ItemRaw): Promise<void> {
    await dbConnection.insert(publishedItemsTable).values({
      itemPath: item.path,
      creatorId: creator.id,
    });
  }

  async deleteForItem(dbConnection: DBConnection, item: ItemRaw): Promise<ItemPublishedRaw> {
    const entry = await this.getForItem(dbConnection, item.path);

    if (!entry) {
      throw new ItemPublishedNotFound(item.id);
    }

    await dbConnection.delete(publishedItemsTable).where(eq(publishedItemsTable.id, entry.id));
    return entry;
  }

  async getRecentItems(dbConnection: DBConnection, limit: number = 10): Promise<ItemRaw[]> {
    const publishedInfos = await dbConnection.query.publishedItemsTable.findMany({
      with: { item: true, account: true },
      orderBy: desc(items.createdAt),
      limit,
    });

    return publishedInfos.map(({ item }) => item);
  }

  async touchUpdatedAt(dbConnection: DBConnection, path: ItemRaw['path']): Promise<string | null> {
    if (!path) {
      throw new Error('path is not defined');
    }
    const updatedAt = new Date().toISOString();

    const result = await dbConnection
      .update(publishedItemsTable)
      .set({ updatedAt })
      .where(eq(publishedItemsTable.itemPath, path))
      .returning();

    return result.length > 0 ? updatedAt : null;
  }
}
