import { count, eq, getTableColumns, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { and, asc, desc, isNotNull, ne } from 'drizzle-orm/sql';

import { Paginated, Pagination, PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { isDescendantOrSelf } from '../../../../drizzle/operations';
import {
  itemMemberships,
  itemsRaw,
  membersView,
  recycledItemDatas,
} from '../../../../drizzle/schema';
import { Item, ItemRaw } from '../../../../drizzle/types';
import { throwsIfParamIsInvalid } from '../../../../repositories/utils';
import { MinimalMember } from '../../../../types';
import { ITEMS_PAGE_SIZE_MAX } from '../../constants';
import { FolderItem } from '../../discrimination';

type CreateRecycledItemDataBody = { itemPath: string; creatorId: string };

export class RecycledItemDataRepository {
  // warning: this call insert in the table
  // but does not soft delete the item
  // should we move to core item?
  async addOne(
    db: DBConnection,
    { itemPath, creatorId }: CreateRecycledItemDataBody,
  ): Promise<void> {
    await db.insert(recycledItemDatas).values({ itemPath, creatorId });
  }

  // warning: this call insert in the table
  // but does not soft delete the item
  // should we move to core item?
  async addMany(db: DBConnection, items: Item[], creator: MinimalMember): Promise<void> {
    const recycled = items.map((item) => ({ itemPath: item.path, creatorId: creator.id }));
    await db.insert(recycledItemDatas).values(recycled);
  }

  async getOwnRecycledItems(
    db: DBConnection,
    account: MinimalMember,
    pagination: Pagination,
  ): Promise<Paginated<Item>> {
    const { page, pageSize } = pagination;
    const limit = Math.min(pageSize, ITEMS_PAGE_SIZE_MAX);
    const skip = (page - 1) * limit;

    const query = db
      .select(getTableColumns(itemsRaw))
      // start with smaller table that can have the most contraints: membership with admin and accountId
      .from(itemMemberships)
      // we want to join on recycled item
      .innerJoin(
        itemsRaw,
        // reduce size by getting only recycled items
        and(
          isDescendantOrSelf(itemsRaw.path, itemMemberships.itemPath),
          isNotNull(itemsRaw.deletedAt),
        ),
      )
      // get top most recycled item
      .innerJoin(recycledItemDatas, eq(recycledItemDatas.itemPath, itemsRaw.path))
      // return item's creator
      .leftJoin(membersView, eq(itemsRaw.creatorId, membersView.id))
      // item membership constraints
      .where(
        and(
          eq(itemMemberships.accountId, account.id),
          eq(itemMemberships.permission, PermissionLevel.Admin),
        ),
      )
      .as('subquery');

    const data = await db
      .select()
      .from(query)
      // show most recently deleted items first
      .orderBy(desc(query.deletedAt))
      // pagination
      .offset(skip)
      .limit(limit);

    return { data, pagination };
  }

  // warning: this call removes from the table
  // but does not soft delete the item
  // should we move to core item?
  async deleteManyByItemPath(db: DBConnection, itemsPath: Item['path'][]): Promise<void> {
    throwsIfParamIsInvalid('itemsPath', itemsPath);
    await db.delete(recycledItemDatas).where(inArray(recycledItemDatas.itemPath, itemsPath));
  }

  /**
   * Return tree below item with deleted = true
   * @param {Item} item item to get descendant tree from
   * @param {boolean} [options.ordered=false] whether the descendants should be ordered by path, guarantees to iterate on parent before children
   * @param {string[]} [options.types] filter out the items by type. If undefined or empty, all types are returned.
   * @returns {Item[]}
   */
  async getDeletedDescendants(db: DBConnection, item: FolderItem): Promise<Item[]> {
    // TODO: no need with drizzle
    // need order column to further sort in this function or afterwards
    // if (ordered || selectOrder) {
    //   query.addSelect('item.order');
    // }
    // if (!ordered) {
    //   return query.getMany();
    // }

    return await db
      .select()
      .from(itemsRaw)
      .where(
        and(
          and(
            isDescendantOrSelf(itemsRaw.path, item.path),
            ne(itemsRaw.id, item.id),
            isNotNull(itemsRaw.deletedAt),
          ),
        ),
      )
      .orderBy(asc(itemsRaw.path));
  }

  async getManyDeletedItemsById(db: DBConnection, itemIds: string[]): Promise<ItemRaw[]> {
    return await db.query.itemsRaw.findMany({
      where: and(isNotNull(itemsRaw.deletedAt), inArray(itemsRaw.id, itemIds)),
    });
  }

  /**
   * Returns flat array of all items below items with ids, including self
   * @param db
   * @param ids
   */
  async getDeletedTreesById(db: DBConnection, ids: Item['id'][]) {
    const descendants = alias(itemsRaw, 'descendants');

    const trees = await db
      .select()
      .from(itemsRaw)

      .innerJoin(descendants, and(isDescendantOrSelf(itemsRaw.path, descendants.path)))
      .where(inArray(itemsRaw.id, ids));

    return trees.map(({ descendants }) => descendants);
  }
}
