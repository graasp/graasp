import { subMonths } from 'date-fns';
import { eq, getTableColumns, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { and, asc, desc, gte, isNotNull, ne } from 'drizzle-orm/sql';

import { type Paginated, type Pagination, PermissionLevel } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { isAncestorOrSelf, isDescendantOrSelf } from '../../../../drizzle/operations';
import {
  itemMembershipsTable,
  itemsRawTable,
  membersView,
  recycledItemDatasTable,
} from '../../../../drizzle/schema';
import type { ItemRaw, MemberRaw } from '../../../../drizzle/types';
import { throwsIfParamIsInvalid } from '../../../../repositories/utils';
import type { MinimalMember } from '../../../../types';
import { MemberCannotAdminItem } from '../../../../utils/errors';
import { ITEMS_PAGE_SIZE_MAX } from '../../constants';
import type { FolderItem } from '../../discrimination';

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
  async addMany(
    dbConnection: DBConnection,
    items: ItemRaw[],
    creator: MinimalMember,
  ): Promise<void> {
    const recycled = items.map((item) => ({ itemPath: item.path, creatorId: creator.id }));
    await dbConnection.insert(recycledItemDatasTable).values(recycled);
  }

  async getOwnRecycledItems(
    dbConnection: DBConnection,
    account: MinimalMember,
    pagination: Pagination,
  ): Promise<Paginated<ItemRaw>> {
    const { page, pageSize } = pagination;
    const limit = Math.min(pageSize, ITEMS_PAGE_SIZE_MAX);
    const skip = (page - 1) * limit;

    // narrow memberships to account's and admin
    const ownMemberships = dbConnection
      .select()
      .from(itemMembershipsTable)
      .where(
        and(
          eq(itemMembershipsTable.accountId, account.id),
          eq(itemMembershipsTable.permission, PermissionLevel.Admin),
        ),
      )
      .as('ownMemberships');

    // get recycled items not older than 3 months
    const autoDeletionDeadline = subMonths(new Date(), 3);
    const query = dbConnection
      .select(getTableColumns(itemsRawTable))
      .from(ownMemberships)
      // get top most recycled item
      // should have admin access on recycled item root
      // newer than the auto deletion deadline
      .innerJoin(
        recycledItemDatasTable,
        and(
          isDescendantOrSelf(recycledItemDatasTable.itemPath, ownMemberships.itemPath),
          gte(recycledItemDatasTable.createdAt, autoDeletionDeadline.toISOString()),
        ),
      )
      // join with item
      .innerJoin(itemsRawTable, and(eq(itemsRawTable.path, recycledItemDatasTable.itemPath)))
      // return item's creator
      .leftJoin(membersView, eq(itemsRawTable.creatorId, membersView.id))
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
  async deleteManyByItemPath(
    dbConnection: DBConnection,
    itemsPath: ItemRaw['path'][],
  ): Promise<void> {
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
  async getDeletedDescendants(dbConnection: DBConnection, item: FolderItem): Promise<ItemRaw[]> {
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
  async getDeletedTreesById(dbConnection: DBConnection, ids: ItemRaw['id'][]) {
    const descendants = alias(itemsRawTable, 'descendants');

    const trees = await dbConnection
      .select()
      .from(itemsRawTable)
      .innerJoin(descendants, and(isDescendantOrSelf(descendants.path, itemsRawTable.path)))
      .where(inArray(itemsRawTable.id, ids));

    return trees.map(({ descendants }) => descendants);
  }

  /**
   * Returns whether the member has an admin access on all the items
   * @param dbConnection database connection
   * @param memberId id of member performing the task
   * @param ids item ids
   * @returns true if the member has access to all items
   */
  async assertAdminAccessForItemIds(
    dbConnection: DBConnection,
    memberId: MemberRaw['id'],
    ids: ItemRaw['id'][],
  ) {
    const im = await dbConnection
      .select({ itemId: itemsRawTable.id })
      .from(itemsRawTable)
      .innerJoin(
        itemMembershipsTable,
        and(
          eq(itemMembershipsTable.accountId, memberId),
          eq(itemMembershipsTable.permission, PermissionLevel.Admin),
          inArray(itemsRawTable.id, ids),
          isAncestorOrSelf(itemMembershipsTable.itemPath, itemsRawTable.path),
        ),
      );

    const imIds = im.map(({ itemId }) => itemId);
    const idsWithoutAccess = ids.filter((m) => !imIds.includes(m));
    if (idsWithoutAccess.length) {
      // return first id lacking access
      throw new MemberCannotAdminItem(idsWithoutAccess[0]);
    }
  }
}
