import { eq, getTableColumns, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { and, asc, desc, isNotNull, ne } from 'drizzle-orm/sql';

import { Paginated, Pagination, PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { isDescendantOrSelf } from '../../../../drizzle/operations';
import {
  itemMembershipsTable,
  itemsRawTable,
  membersView,
  recycledItemDatasTable,
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
    dbConnection: DBConnection,
    { itemPath, creatorId }: CreateRecycledItemDataBody,
  ): Promise<void> {
    await dbConnection.insert(recycledItemDatasTable).values({ itemPath, creatorId });
  }

  // warning: this call insert in the table
  // but does not soft delete the item
  // should we move to core item?
  async addMany(dbConnection: DBConnection, items: Item[], creator: MinimalMember): Promise<void> {
    const recycled = items.map((item) => ({ itemPath: item.path, creatorId: creator.id }));
    await dbConnection.insert(recycledItemDatasTable).values(recycled);
  }

  async getOwnRecycledItems(
    dbConnection: DBConnection,
    account: MinimalMember,
    pagination: Pagination,
  ): Promise<Paginated<Item>> {
    const { page, pageSize } = pagination;
    const limit = Math.min(pageSize, ITEMS_PAGE_SIZE_MAX);
    const skip = (page - 1) * limit;

    const query = dbConnection
      .select(getTableColumns(itemsRawTable))
      // start with smaller table that can have the most contraints: membership with admin and accountId
      .from(itemMembershipsTable)
      // we want to join on recycled item
      .innerJoin(
        itemsRawTable,
        // reduce size by getting only recycled items
        and(
          isDescendantOrSelf(itemsRawTable.path, itemMembershipsTable.itemPath),
          isNotNull(itemsRawTable.deletedAt),
        ),
      )
      // get top most recycled item
      .innerJoin(recycledItemDatasTable, eq(recycledItemDatasTable.itemPath, itemsRawTable.path))
      // return item's creator
      .leftJoin(membersView, eq(itemsRawTable.creatorId, membersView.id))
      // item membership constraints
      .where(
        and(
          eq(itemMembershipsTable.accountId, account.id),
          eq(itemMembershipsTable.permission, PermissionLevel.Admin),
        ),
      )
      .as('subquery');

    const data = await dbConnection
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
  async deleteManyByItemPath(dbConnection: DBConnection, itemsPath: Item['path'][]): Promise<void> {
    throwsIfParamIsInvalid('itemsPath', itemsPath);
    await dbConnection
      .delete(recycledItemDatasTable)
      .where(inArray(recycledItemDatasTable.itemPath, itemsPath));
  }

  /**
   * Return tree below item with deleted = true
   * @param {Item} item item to get descendant tree from
   * @param {boolean} [options.ordered=false] whether the descendants should be ordered by path, guarantees to iterate on parent before children
   * @param {string[]} [options.types] filter out the items by type. If undefined or empty, all types are returned.
   * @returns {Item[]}
   */
  async getDeletedDescendants(dbConnection: DBConnection, item: FolderItem): Promise<Item[]> {
    // TODO: no need with drizzle
    // need order column to further sort in this function or afterwards
    // if (ordered || selectOrder) {
    //   query.addSelect('item.order');
    // }
    // if (!ordered) {
    //   return query.getMany();
    // }

    return await dbConnection
      .select()
      .from(itemsRawTable)
      .where(
        and(
          and(
            isDescendantOrSelf(itemsRawTable.path, item.path),
            ne(itemsRawTable.id, item.id),
            isNotNull(itemsRawTable.deletedAt),
          ),
        ),
      )
      .orderBy(asc(itemsRawTable.path));
  }

  async getManyDeletedItemsById(dbConnection: DBConnection, itemIds: string[]): Promise<ItemRaw[]> {
    return await dbConnection.query.itemsRawTable.findMany({
      where: and(isNotNull(itemsRawTable.deletedAt), inArray(itemsRawTable.id, itemIds)),
    });
  }

  /**
   * Returns flat array of all items below items with ids, including self
   * @param db
   * @param ids
   */
  async getDeletedTreesById(dbConnection: DBConnection, ids: Item['id'][]) {
    const descendants = alias(itemsRawTable, 'descendants');

    const trees = await dbConnection
      .select()
      .from(itemsRawTable)
      .innerJoin(descendants, and(isDescendantOrSelf(descendants.path, itemsRawTable.path)))
      .where(inArray(itemsRawTable.id, ids));

    return trees.map(({ descendants }) => descendants);
  }
}
