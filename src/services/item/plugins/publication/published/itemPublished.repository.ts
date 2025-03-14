import { count, desc, eq, inArray, sql } from 'drizzle-orm';
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
      .innerJoin(items, isAncestorOrSelf(publishedItems.itemPath, itemPath))
      .innerJoin(membersView, eq(items.creatorId, membersView.id))
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

  // async getForMember(db: DBConnection, memberId: string): Promise<Item[]> {
  //   const itemPublished = await this.repository
  //     .createQueryBuilder('pi')
  //     // join with memberships that are at or above the item published
  //     // add the condition that the membership needs to be admin or write
  //     .innerJoin(
  //       'item_membership',
  //       'im',
  //       'im.item_path @> pi.item_path and im.permission IN (:...permissions)',
  //       { permissions: [PermissionLevel.Admin, PermissionLevel.Write] },
  //     )
  //     // add a condition to the join to keep only relations for the accountId we are interested in
  //     // this removes the need for the accountId in the where condition
  //     .innerJoin('account', 'm', 'im.account_id = m.id and m.id = :accountId', {
  //       accountId: memberId,
  //     })
  //     // these two joins are for typeorm to get the relation data
  //     .innerJoinAndSelect('pi.item', 'item') // will ignore soft delted items
  //     .innerJoinAndSelect('item.creator', 'account') // will ignore null creators (deleted accounts)
  //     .getMany();

  //   return itemPublished.map(({ item }) => item);
  // }

  // // return public item entry? contains when it was published
  // async getAllItems(db: DBConnection) {
  //   const publishedRows = await this.repository.find({
  //     relations: { item: true },
  //   });
  //   return publishedRows.map(({ item }) => item);
  // }

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

  async touchUpdatedAt(db: DBConnection, path: Item['path']): Promise<string> {
    const updatedAt = new Date().toISOString();
    const res = await db
      .update(publishedItems)
      .set({ updatedAt })
      .where(eq(publishedItems.itemPath, path))
      .returning();
    if (res.length !== 1) {
      throw new ItemPublishedNotFound();
    }
    return updatedAt;
  }
}
