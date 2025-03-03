import { desc, eq, sql } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../../../../../drizzle/db';
import { isAncestorOrSelf } from '../../../../../../drizzle/operations';
import {
  items,
  membersView,
  publishedItems,
} from '../../../../../../drizzle/schema';
import {
  Item,
  ItemPublishedWithItemAndAccount,
} from '../../../../../../drizzle/types';
import { MinimalMember } from '../../../../../../types';
import { assertIsDefined } from '../../../../../../utils/assertions';
import { mapById } from '../../../../../utils';
import { ItemPublishedNotFound } from '../errors';

@singleton()
export class ItemPublishedRepository {
  /**
   * Returns inherited published entry for given item
   * @param item
   * @returns published entry if the item is published, null otherwise
   */
  async getForItem(
    db: DBConnection,
    itemPath: string,
  ): Promise<ItemPublishedWithItemAndAccount | null> {
    const res = await db
      .select()
      .from(publishedItems)
      .innerJoin(membersView, eq(publishedItems.creatorId, membersView.id))
      .innerJoin(items, isAncestorOrSelf(publishedItems.itemPath, itemPath))
      .orderBy(desc(sql`nlevel(${publishedItems.itemPath})`))
      .limit(1);
    const entry = res[0];
    assertIsDefined(entry);
    const mappedEntry = {
      ...entry.item_published,
      item: entry.item_view,
      creator: entry.members_view,
    };
    return mappedEntry;
  }

  async getForItems(db: DBConnection, items: Item[]) {
    const paths = items.map((i) => i.path);
    const ids = items.map((i) => i.id);
    const entries = await this.repository
      .createQueryBuilder('pi')
      .innerJoinAndSelect(
        'pi.item',
        'item',
        'pi.item @> ARRAY[:...paths]::ltree[]',
        {
          paths,
        },
      )
      .innerJoinAndSelect('pi.creator', 'member')
      .getMany();

    return mapById({
      keys: ids,
      findElement: (id) =>
        entries.find((e) =>
          items.find((i) => i.id === id)?.path.startsWith(e.item.path),
        ),
      buildError: (id) => new ItemPublishedNotFound(id),
    });
  }

  async getForMember(db: DBConnection, memberId: string): Promise<Item[]> {
    const itemPublished = await this.repository
      .createQueryBuilder('pi')
      // join with memberships that are at or above the item published
      // add the condition that the membership needs to be admin or write
      .innerJoin(
        'item_membership',
        'im',
        'im.item_path @> pi.item_path and im.permission IN (:...permissions)',
        { permissions: [PermissionLevel.Admin, PermissionLevel.Write] },
      )
      // add a condition to the join to keep only relations for the accountId we are interested in
      // this removes the need for the accountId in the where condition
      .innerJoin('account', 'm', 'im.account_id = m.id and m.id = :accountId', {
        accountId: memberId,
      })
      // these two joins are for typeorm to get the relation data
      .innerJoinAndSelect('pi.item', 'item') // will ignore soft delted items
      .innerJoinAndSelect('item.creator', 'account') // will ignore null creators (deleted accounts)
      .getMany();

    return itemPublished.map(({ item }) => item);
  }

  // return public item entry? contains when it was published
  async getAllItems(db: DBConnection) {
    const publishedRows = await this.repository.find({
      relations: { item: true },
    });
    return publishedRows.map(({ item }) => item);
  }

  // Must Implement a proper Paginated<Type> if more complex pagination is needed in the future
  async getPaginatedItems(
    db: DBConnection,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<[ItemPublished[], number]> {
    const [items, total] = await this.repository
      .createQueryBuilder('item_published')
      .innerJoinAndSelect('item_published.item', 'item') // will ignore soft deleted item
      .innerJoinAndSelect('item.creator', 'member') // will ignore null creator id (deleted account)
      .take(pageSize)
      .skip((page - 1) * pageSize)
      .getManyAndCount();
    return [items, total];
  }

  async post(db: DBConnection, creator: MinimalMember, item: Item) {
    const res = db
      .insert(publishedItems)
      .values({
        itemPath: item.path,
        creatorId: creator.id,
      })
      .returning();
    return res[0];
  }

  async deleteForItem(db: DBConnection, item: Item) {
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
    await db
      .update(publishedItems)
      .set({ updatedAt })
      .where(eq(publishedItems.itemPath, path));
    return updatedAt;
  }
}
