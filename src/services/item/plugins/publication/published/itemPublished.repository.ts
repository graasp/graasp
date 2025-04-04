import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../../drizzle/db';
import { isAncestorOrSelf } from '../../../../../drizzle/operations';
import { items, membersView, publishedItems } from '../../../../../drizzle/schema';
import {
  Item,
  ItemPublishedRaw,
  ItemPublishedWithItemWithCreator,
  MemberRaw,
} from '../../../../../drizzle/types';
import { MinimalMember } from '../../../../../types';
import { ItemPublishedNotFound } from './errors';

@singleton()
export class ItemPublishedRepository {
  /**
   * Returns inherited published entry for given item
   * @param item
   * @returns published entry if the item is published, null otherwise
   */
  async getForItem(
    db: DBConnection,
    itemPath: Item['path'],
  ): Promise<ItemPublishedWithItemWithCreator | null> {
    const res = await db
      .select()
      .from(publishedItems)
      // .innerJoin(membersView, eq(publishedItems.creatorId, membersView.id))
      .innerJoin(
        items,
        and(
          isAncestorOrSelf(publishedItems.itemPath, itemPath),
          eq(publishedItems.itemPath, items.path),
        ),
      )
      .leftJoin(membersView, eq(items.creatorId, membersView.id))
      .orderBy(desc(sql`nlevel(${publishedItems.itemPath})`))
      .limit(1);

    if (res.length) {
      const entry = res[0];
      const mappedEntry = {
        ...entry.item_published,
        item: { ...entry.item_view, creator: entry.members_view as MemberRaw },
        // creator: entry.members_view,
      };
      return mappedEntry;
    }
    return null;
  }

  async getForItems(
    db: DBConnection,
    itemPaths: Item['path'][],
  ): Promise<ItemPublishedWithItemWithCreator[]> {
    const result = await db
      .select()
      .from(publishedItems)
      .innerJoin(items, inArray(publishedItems.itemPath, itemPaths))
      .leftJoin(membersView, eq(items.creatorId, membersView.id));

    return result.map(({ item_published, item_view, members_view }) => ({
      item: { ...item_view, creator: members_view as MemberRaw },
      ...item_published,
    }));
  }

  // Must Implement a proper Paginated<Type> if more complex pagination is needed in the future
  async getPaginatedItems(
    db: DBConnection,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<[ItemPublishedWithItemWithCreator[], number]> {
    const results = await db
      .select()
      .from(publishedItems)
      // will ignore soft deleted item
      .innerJoin(items, eq(publishedItems.itemPath, items.path))
      // will ignore null creator id (deleted
      .innerJoin(membersView, eq(items.creatorId, membersView.id))
      .offset((page - 1) * pageSize)
      .limit(pageSize);
    const mappedResults = results.map(({ item_published, item_view, members_view }) => ({
      ...item_published,
      item: { ...item_view, creator: members_view as MemberRaw },
    }));
    const total = (await db.select({ count: count() }).from(publishedItems))[0].count;

    return [mappedResults, total];
  }

  async post(db: DBConnection, creator: MinimalMember, item: Item): Promise<void> {
    await db.insert(publishedItems).values({
      itemPath: item.path,
      creatorId: creator.id,
    });
  }

  async deleteForItem(db: DBConnection, item: Item): Promise<ItemPublishedRaw> {
    const entry = await this.getForItem(db, item.path);

    if (!entry) {
      throw new ItemPublishedNotFound(item.id);
    }

    await db.delete(publishedItems).where(eq(publishedItems.id, entry.id));
    return entry;
  }

  async getRecentItems(db: DBConnection, limit: number = 10): Promise<Item[]> {
    const publishedInfos = await db.query.publishedItems.findMany({
      with: { item: true, account: true },
      orderBy: desc(items.createdAt),
      limit,
    });

    return publishedInfos.map(({ item }) => item);
  }

  async touchUpdatedAt(db: DBConnection, path: Item['path']): Promise<string | null> {
    const updatedAt = new Date().toISOString();

    const result = await db
      .update(publishedItems)
      .set({ updatedAt })
      .where(eq(publishedItems.itemPath, path))
      .returning();

    return result.length > 0 ? updatedAt : null;
  }
}
