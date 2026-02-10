import {
  SQL,
  asc,
  getTableColumns,
  getViewSelectedFields,
  inArray,
  isNull,
  ne,
  notInArray,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { and, desc, eq, ilike, sql } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { PermissionLevelCompare, type ResultOf, type UUID, getChildFromPath } from '@graasp/sdk';

import type { DBConnection } from '../../drizzle/db';
import { isAncestorOrSelf, isDescendantOrSelf } from '../../drizzle/operations';
import {
  accountsTable,
  itemMembershipsTable,
  items,
  itemsRawTable,
  membersView,
} from '../../drizzle/schema';
import type {
  ItemMembershipRaw,
  ItemMembershipWithItem,
  ItemMembershipWithItemAndAccount,
  ItemMembershipWithItemAndCompleteAccount,
  MemberRaw,
} from '../../drizzle/types';
import type { AuthenticatedUser, MinimalMember, PermissionLevel } from '../../types';
import {
  InvalidMembership,
  InvalidPermissionLevel,
  ItemMembershipNotFound,
  ItemNotFound,
  MemberNotFound,
  ModifyExistingMembership,
} from '../../utils/errors';
import type { ItemRaw } from '../item/item';
import { mapById } from '../utils';
import { PermissionType, getPermissionsAtItemSql } from './utils';

type ItemPath = ItemRaw['path'];
type AccountId = string;
type CreatorId = string;

type CreateItemMembershipBody = {
  itemPath: ItemPath;
  accountId: AccountId;
  creatorId?: CreatorId;
  permission: PermissionLevel;
};
type UpdateItemMembershipBody = { permission: PermissionLevel };
type KeyCompositionItemMembership = {
  itemPath: ItemPath;
  accountId: AccountId;
};
type ResultMoveHousekeeping = {
  inserts: CreateItemMembershipBody[];
  deletes: KeyCompositionItemMembership[];
};
type DetachedMoveHousekeepingType = {
  accountId: string;
  itemPath: string;
  permission: PermissionLevel;
};
type MoveHousekeepingType = DetachedMoveHousekeepingType & {
  action: number;
  inherited: PermissionLevel;
  action2IgnoreInherited: boolean;
};

@singleton()
export class ItemMembershipRepository {
  constructor() {}

  async getOne(dbConnection: DBConnection, id: string): Promise<ItemMembershipRaw | undefined> {
    const res = await dbConnection.query.itemMembershipsTable.findFirst({
      where: eq(itemMembershipsTable.id, id),
      with: { creator: true, item: true, account: true },
    });
    return res;
  }

  /**
   * Create multiple memberships given an array of partial membership objects.
   * @param memberships Array of objects with properties: `memberId`, `itemPath`, `permission`, `creator`
   */
  async addMany(dbConnection: DBConnection, memberships: CreateItemMembershipBody[]) {
    const itemsMemberships = await dbConnection
      .insert(itemMembershipsTable)
      .values(
        memberships.map((m) => ({
          permission: m.permission,
          itemPath: m.itemPath,
          accountId: m.accountId,
          creatorId: m.creatorId,
        })),
      )
      .returning();

    return itemsMemberships;
  }

  async deleteOne(
    dbConnection: DBConnection,
    itemMembershipId: string,
    args: { purgeBelow?: boolean } = { purgeBelow: true },
  ): Promise<void> {
    const itemMembership = await dbConnection.query.itemMembershipsTable.findFirst({
      where: eq(itemMembershipsTable.id, itemMembershipId),
    });
    if (!itemMembership) {
      throw new ItemMembershipNotFound();
    }

    if (args.purgeBelow) {
      const { itemPath, accountId } = itemMembership;
      const itemMembershipsBelow = await this.getAllBellowItemPathForAccount(
        dbConnection,
        itemPath,
        accountId,
      );

      if (itemMembershipsBelow.length > 0) {
        // return list of subtasks for task manager to execute and
        // delete all memberships in the (sub)tree, one by one, in reverse order (bottom > top)
        await dbConnection.delete(itemMembershipsTable).where(
          inArray(
            itemMembershipsTable.id,
            itemMembershipsBelow.map(({ id }) => id),
          ),
        );
      }
    }
    await dbConnection
      .delete(itemMembershipsTable)
      .where(eq(itemMembershipsTable.id, itemMembershipId));
  }

  /**
   * Delete multiple memberships matching `memberId`+`itemPath`
   * from partial memberships in given array.
   * @param composedKeys List of objects with: `accountId`, `itemPath`
   */
  async deleteManyByItemPathAndAccount(
    dbConnection: DBConnection,
    composedKeys: {
      itemPath: ItemPath;
      accountId: AccountId;
    }[],
  ): Promise<void> {
    for (const { itemPath, accountId } of composedKeys) {
      await dbConnection
        .delete(itemMembershipsTable)
        .where(
          and(
            eq(itemMembershipsTable.itemPath, itemPath),
            eq(itemMembershipsTable.accountId, accountId),
          ),
        );
    }
  }

  async get(dbConnection: DBConnection, id: string): Promise<ItemMembershipWithItemAndAccount> {
    const im = await dbConnection.query.itemMembershipsTable.findFirst({
      where: eq(itemMembershipsTable.id, id),
      with: { account: true, item: true },
    });

    if (!im) {
      throw new ItemMembershipNotFound({ id });
    }

    return im;
  }

  /**
   *
   * @param db Database connection or transaction connection
   * @param accountId the user id
   * @param itemId the itemId that we are testing for membership
   * @returns true if the user has a membership (direct or inherited) for the itemId, false otherwise
   */
  async hasMembershipOnItem(
    dbConnection: DBConnection,
    accountId: string,
    itemId: string,
  ): Promise<boolean> {
    if (!accountId) {
      throw new MemberNotFound();
    } else if (!itemId) {
      throw new ItemNotFound(itemId);
    }

    const res = await dbConnection
      .select({ id: itemMembershipsTable.id })
      .from(itemMembershipsTable)
      .leftJoin(items, eq(items.path, itemMembershipsTable.itemPath))
      // TODO: we should probably check for ancestors of the item with itemId input to have a membership.
      .where(and(eq(itemMembershipsTable.accountId, accountId), eq(items.id, itemId)));
    // we were able to get a result, so the accountId has a membership on the item
    if (res.length >= 1) {
      return true;
    }
    return false;
  }

  async getByAccountAndItemPath(
    dbConnection: DBConnection,
    accountId: string,
    itemPath: string,
  ): Promise<ItemMembershipRaw | undefined> {
    if (!accountId) {
      throw new MemberNotFound();
    } else if (!itemPath) {
      throw new ItemNotFound(itemPath);
    }

    // CHECK: does it need to take into account inheritance ?
    return await dbConnection.query.itemMembershipsTable.findFirst({
      where: and(
        eq(itemMembershipsTable.accountId, accountId),
        eq(itemMembershipsTable.itemPath, itemPath),
      ),
      with: {
        account: true,
        item: true,
      },
    });
  }

  async getAllBellowItemPathForAccount(
    dbConnection: DBConnection,
    itemPath: ItemPath,
    accountId: string,
  ) {
    const membershipsBelowItemPath = await dbConnection.query.itemMembershipsTable.findMany({
      where: and(
        isDescendantOrSelf(itemMembershipsTable.itemPath, itemPath),
        ne(itemMembershipsTable.itemPath, itemPath),
        eq(itemMembershipsTable.accountId, accountId),
      ),
      with: { account: true },
    });
    return membershipsBelowItemPath;
  }

  /**
   * Return membership under given item (without self memberships)
   * @param item
   * @param accountId
   * @returns
   */
  async getAllBelow(
    dbConnection: DBConnection,
    itemPath: ItemPath,
    accountId: string,
    {
      considerLocal = false,
      selectItem = false,
    }: { considerLocal?: boolean; selectItem?: boolean } = {},
  ): Promise<ItemMembershipRaw[]> {
    const andConditions = [
      isDescendantOrSelf(itemMembershipsTable.itemPath, itemPath),
      eq(itemMembershipsTable.accountId, accountId),
    ];

    if (!considerLocal) {
      andConditions.push(ne(itemMembershipsTable.itemPath, itemPath));
    }

    return await dbConnection.query.itemMembershipsTable.findMany({
      where: and(...andConditions),
      with: {
        item: selectItem ? true : undefined,
      },
    });
  }

  /**
   *  get accessible items name for actor and given params
   *  */
  async getAccessibleItemNames(
    dbConnection: DBConnection,
    actor: AuthenticatedUser,
    { startWith }: { startWith?: string },
  ): Promise<string[]> {
    const im = alias(itemMembershipsTable, 'im');
    const im1 = alias(itemMembershipsTable, 'im1');

    const andConditions = [
      eq(im.accountId, actor.id),
      eq(
        items.path,
        dbConnection
          .select({ itemPath: im1.itemPath })
          .from(im1)
          .where(and(isDescendantOrSelf(im.itemPath, im1.itemPath), eq(im1.accountId, actor.id)))
          .orderBy(asc(im1.itemPath))
          .limit(1),
      ),
    ];

    if (startWith) {
      andConditions.push(ilike(items.name, `${startWith}%`));
    }

    const result = await dbConnection
      .select({ name: items.name })
      .from(im)
      .innerJoin(items, eq(im.itemPath, items.path))
      .where(and(...andConditions));

    return result.map(({ name }) => name);
  }

  async getForItem(
    dbConnection: DBConnection,
    item: ItemRaw,
  ): Promise<ItemMembershipWithItemAndCompleteAccount[]> {
    const imTree = dbConnection
      .select()
      .from(itemMembershipsTable)
      .where(isAncestorOrSelf(itemMembershipsTable.itemPath, item.path))
      .as('im_tree');
    const itemTree = dbConnection
      .select()
      .from(itemsRawTable)
      .where(isAncestorOrSelf(itemsRawTable.path, item.path))
      .as('item_tree');

    const memberships = await dbConnection
      // return only one membership per account
      .selectDistinctOn([accountsTable.id])
      .from(imTree)
      .innerJoin(itemTree, eq(imTree.itemPath, itemTree.path))
      .innerJoin(accountsTable, eq(imTree.accountId, accountsTable.id))
      // select lowest membership per account
      .orderBy(() => [asc(accountsTable.id), desc(itemTree.path)]);

    const mappedMemberships = memberships.map(({ item_tree, account, im_tree }) => ({
      item: item_tree,
      account,
      ...im_tree,
    })) as ItemMembershipWithItemAndCompleteAccount[];

    return mappedMemberships;
  }

  async getForManyItems(
    dbConnection: DBConnection,
    items: ItemRaw[],
    { accountId = undefined }: { accountId?: UUID } = {},
  ): Promise<ResultOf<ItemMembershipWithItemAndAccount[]>> {
    if (items.length === 0) {
      return { data: {}, errors: [] };
    }

    const ids = items.map((i) => i.id);

    const andConditions: SQL[] = [inArray(itemsRawTable.id, ids)];

    andConditions.push(isNull(itemsRawTable.deletedAt));

    if (accountId) {
      andConditions.push(eq(itemMembershipsTable.accountId, accountId));
    }

    const memberships = await dbConnection
      .select()
      .from(itemMembershipsTable)
      .innerJoin(accountsTable, eq(itemMembershipsTable.accountId, accountsTable.id))
      .innerJoin(itemsRawTable, isAncestorOrSelf(itemMembershipsTable.itemPath, itemsRawTable.path))
      .where(and(...andConditions));
    const mappedMemberships = memberships.map(({ item, account, item_membership }) => ({
      item,
      account,
      ...item_membership,
    }));

    const mapByPath = mapById({
      keys: items.map(({ path }) => path),
      findElement: (path) => mappedMemberships.filter(({ item }) => path.includes(item.path)),
      buildError: (path) => new ItemMembershipNotFound({ path }),
    });

    // use id as key
    const idToMemberships = Object.fromEntries(
      Object.entries(mapByPath.data).map(([key, value]) => [getChildFromPath(key), value]),
    );

    return { data: idToMemberships, errors: mapByPath.errors };
  }

  async getInheritedMany(
    dbConnection: DBConnection,
    inputItems: ItemRaw[],
    accountId: AccountId,
    considerLocal = false,
  ): Promise<ResultOf<ItemMembershipWithItem>> {
    if (inputItems.length === 0) {
      return { data: {}, errors: [] };
    }

    const ids = inputItems.map((i) => i.id);

    const andConditions = [
      isNull(itemsRawTable.deletedAt),
      eq(itemMembershipsTable.accountId, accountId),
    ];

    if (!considerLocal) {
      andConditions.push(notInArray(itemsRawTable.id, ids));
    }
    const memberships = await dbConnection
      .select({
        ...getTableColumns(itemMembershipsTable),
        item: getTableColumns(itemsRawTable),
        // Keep only closest membership per descendant
        descendantId: itemsRawTable.id,
      })
      .from(itemMembershipsTable)
      // Map each membership to the item it can affect
      .innerJoin(itemsRawTable, isAncestorOrSelf(itemMembershipsTable.itemPath, itemsRawTable.path))
      .where(and(...andConditions))
      // Keep only closest membership per descendant
      .orderBy(() => [asc(itemsRawTable.id), desc(sql`nlevel(${itemMembershipsTable.itemPath})`)]);

    const result = mapById({
      keys: ids,
      findElement: (id) => memberships.find(({ descendantId }) => descendantId === id),
      buildError: (id) => new ItemMembershipNotFound({ id }),
    });

    return result;
  }

  /** check member's membership "at" item */
  async getInherited(
    dbConnection: DBConnection,
    itemPath: ItemPath,
    accountId: AccountId,
    considerLocal = false,
  ): Promise<ItemMembershipWithItemAndAccount | null> {
    const andConditions = [eq(itemMembershipsTable.accountId, accountId)];

    if (!considerLocal) {
      andConditions.push(ne(itemMembershipsTable.itemPath, itemPath));
    }

    const memberships = await dbConnection
      .select()
      .from(itemMembershipsTable)
      .innerJoin(
        itemsRawTable,
        and(
          eq(itemMembershipsTable.itemPath, itemsRawTable.path),
          isAncestorOrSelf(itemMembershipsTable.itemPath, itemPath),
        ),
      )
      .innerJoin(accountsTable, eq(itemMembershipsTable.accountId, accountsTable.id))
      .where(and(...andConditions))
      .orderBy(desc(sql`nlevel(${itemMembershipsTable.itemPath})`));

    const mappedMemberships = memberships.map(({ item, account, item_membership }) => ({
      item,
      account,
      ...item_membership,
    }));

    // TODO: optimize
    // order by array https://stackoverflow.com/questions/866465/order-by-the-in-value-list
    // order by https://stackoverflow.com/questions/17603907/order-by-enum-field-in-mysql
    const result = mappedMemberships.reduce(
      (highest: ItemMembershipWithItemAndAccount | null, m: ItemMembershipWithItemAndAccount) => {
        if (PermissionLevelCompare.gte(m.permission, highest?.permission ?? 'read')) {
          return m;
        }
        return highest;
      },
      null,
    );

    if (result) {
      return result;
    }

    // no membership in the tree
    return null;
  }

  async getAdminsForItem(dbConnection: DBConnection, itemPath: string): Promise<MemberRaw[]> {
    return (await dbConnection
      .select(getViewSelectedFields(membersView))
      .from(itemMembershipsTable)
      .innerJoin(membersView, eq(membersView.id, itemMembershipsTable.accountId))
      .where(
        and(
          isAncestorOrSelf(itemMembershipsTable.itemPath, itemPath),
          eq(itemMembershipsTable.permission, 'admin'),
        ),
      )) as MemberRaw[];
  }

  async updateOne(
    dbConnection: DBConnection,
    itemMembershipId: string,
    data: UpdateItemMembershipBody,
  ): Promise<ItemMembershipWithItem> {
    const itemMembership = await this.get(dbConnection, itemMembershipId);
    // check member's inherited membership
    const { item, account: memberOfMembership } = itemMembership;

    const inheritedMembership = await this.getInherited(
      dbConnection,
      item.path,
      memberOfMembership.id,
    );

    const { permission } = data;
    if (inheritedMembership) {
      const { permission: inheritedPermission } = inheritedMembership;

      if (permission === inheritedPermission) {
        // downgrading to same as the inherited, delete current membership
        await this.delete(dbConnection, itemMembership.id);
        return inheritedMembership;
      } else if (PermissionLevelCompare.lt(permission, inheritedPermission)) {
        // if downgrading to "worse" than inherited
        throw new InvalidPermissionLevel(itemMembershipId);
      }
    }

    // check existing memberships lower in the tree
    const membershipsBelow = await this.getAllBellowItemPathForAccount(
      dbConnection,
      item.path,
      memberOfMembership.id,
    );
    let tasks: Promise<unknown>[] = [];
    if (membershipsBelow.length > 0) {
      // check if any have the same or a worse permission level
      const membershipsBelowToDiscard = membershipsBelow.filter((m) =>
        PermissionLevelCompare.lte(m.permission, permission),
      );

      if (membershipsBelowToDiscard.length > 0) {
        // return subtasks to remove redundant existing memberships
        // and to update the existing one
        tasks = membershipsBelowToDiscard.map(async (m) => await this.delete(dbConnection, m.id));
      }
    }

    tasks.push(
      dbConnection
        .update(itemMembershipsTable)
        .set({ permission })
        .where(eq(itemMembershipsTable.id, itemMembershipId)),
    );
    // TODO: optimize
    await Promise.all(tasks);

    return this.get(dbConnection, itemMembershipId);
  }

  async addOne(
    dbConnection: DBConnection,
    { itemPath, accountId, creatorId, permission }: CreateItemMembershipBody,
  ): Promise<ItemMembershipRaw> {
    // prepare membership but do not save it
    const itemId = getChildFromPath(itemPath);

    const inheritedMembership = await this.getInherited(dbConnection, itemPath, accountId, true);
    if (inheritedMembership) {
      const { item: itemFromPermission, permission: inheritedPermission, id } = inheritedMembership;
      // fail if trying to add a new membership for the same member and item
      if (itemFromPermission.id === itemId) {
        throw new ModifyExistingMembership({ id });
      }
      if (PermissionLevelCompare.lte(permission, inheritedPermission)) {
        // trying to add a membership with the same or "worse" permission level than
        // the one inherited from the membership "above"
        throw new InvalidMembership({
          itemId: itemId,
          accountId: accountId,
          permission,
        });
      }
    }

    // check existing memberships lower in the tree
    const membershipsBelow = await this.getAllBelow(dbConnection, itemPath, accountId);
    let tasks: Promise<unknown>[] = [];
    if (membershipsBelow.length > 0) {
      // check if any have the same or a worse permission level
      const membershipsBelowToDiscard = membershipsBelow.filter((m) =>
        PermissionLevelCompare.lte(m.permission, permission),
      );

      if (membershipsBelowToDiscard.length > 0) {
        // remove redundant existing memberships and to create the new one
        tasks = membershipsBelowToDiscard.map(async (membership) => {
          await this.delete(dbConnection, membership.id);
        });
      }
    }

    // create new membership
    const itemMembership = await dbConnection
      .insert(itemMembershipsTable)
      .values({
        permission,
        itemPath: itemPath,
        accountId: accountId,
        creatorId: creatorId,
      })
      .returning();
    await Promise.all(tasks);

    return itemMembership[0];
  }

  // UTILS

  private async delete(dbConnection: DBConnection, membershipId: string) {
    await dbConnection
      .delete(itemMembershipsTable)
      .where(eq(itemMembershipsTable.id, membershipId));
  }

  /**
   * Retrieves all memberships related to the ancestors of the given item and returns the memberships
   * we need to create so that accounts with permissions further up the tree maintain their best permissions
   * on the item after it has been moved to the root.
   *
   * Identify any new memberships that will be necessary to create
   * after moving the item from its parent item to *no-parent*.
   *
   * Moving to *no-parent* is simpler so this method is used instead of `moveHousekeeping()`.
   * @param item Item that will be moved
   * @param account Member used as `creator` for any new memberships
   * @returns Object with `inserts` and `deletes` arrays of memberships to create and delete after moving the item to the root. `deletes` will always be empty.
   */
  async detachedMoveHousekeeping(
    dbConnection: DBConnection,
    item: ItemRaw,
    account: MinimalMember,
  ) {
    // Get the Id of the item when it will be moved to the root
    const index = item.path.lastIndexOf('.');
    const itemIdAsPath = item.path.slice(index + 1);

    // For each account that belongs to an ancestor of the element,
    // retrieve its best permission and the path to the deepest element (closest to the element).
    const rows = await dbConnection
      .select({
        accountId: itemMembershipsTable.accountId,
        itemPath: sql<ItemRaw['path']>`'max(item_path::text)::ltree'`,
        permission: sql<PermissionLevel>`max(permission)`,
      })
      .from(itemMembershipsTable)
      .where(isAncestorOrSelf(itemMembershipsTable.itemPath, item.path))
      .groupBy(itemMembershipsTable.accountId);

    // const rows = (await this.repository
    //   .createQueryBuilder('item_membership')
    //   .select('account_id', 'accountId')
    //   .addSelect('max(item_path::text)::ltree', 'itemPath') // Get the longest path
    //   .addSelect('max(permission)', 'permission') // Get the best permission
    //   .where('item_path @> :path', { path: item.path })
    //   .groupBy('account_id')
    //   .getRawMany()) as DetachedMoveHousekeepingType[];

    return rows.reduce<ResultMoveHousekeeping>(
      (changes, row) => {
        const { accountId, itemPath, permission } = row;
        if (itemPath !== item.path) {
          changes.inserts.push({
            accountId,
            itemPath: itemIdAsPath,
            permission,
            creatorId: account.id,
          });
        }

        return changes;
      },
      {
        inserts: [],
        deletes: [],
      },
    );
  }

  /**
   * Identify any new memberships to be created, and any existing memberships to be
   * removed, after moving the item. These are adjustmnents necessary
   * to keep the constraints in the memberships:
   *
   * * accounts inherit membership permissions from memberships in items 'above'
   * * memberships 'down the tree' can only improve on the permission level and cannot repeat: read > write > admin
   *
   * ** Needs to run before the actual item move **
   * @param item Item that will be moved
   * @param account Account used as `creator` for any new memberships
   * @param newParentItem Parent item to where `item` will be moved to
   */
  async moveHousekeeping(
    dbConnection: DBConnection,
    item: ItemRaw,
    account: MinimalMember,
    newParentItem?: ItemRaw,
  ) {
    if (!newParentItem) {
      // Moving to the root
      return this.detachedMoveHousekeeping(dbConnection, item, account);
    }

    const { path: newParentItemPath } = newParentItem;
    const index = item.path.lastIndexOf('.');

    // If the a '.' has been found (>= 0) in item's path, this means that it has a parent.
    // parentItemPath is the path of the direct parent item
    const parentItemPath = index >= 0 ? item.path.slice(0, index) : undefined;
    // itemIdAsPath is the path of the item without any parent
    const itemIdAsPath = index >= 0 ? item.path.slice(index + 1) : item.path;

    const { rows } = await dbConnection.execute(
      sql.raw(`
      SELECT
        account_id AS "accountId",
        item_path AS "itemPath",
        permission,
        action,
        first_value(permission) OVER (PARTITION BY account_id ORDER BY action) AS inherited,
        min(nlevel(item_path)) OVER (PARTITION BY account_id) > nlevel('${newParentItemPath}') AS "action2IgnoreInherited"
      FROM (
        -- "last" inherited permission, for each member, at the destination item
        SELECT
          account_id,
          '${newParentItemPath}'::ltree AS item_path,
          max(permission) AS permission,
          ${PermissionType.InheritedAtDestination} AS action -- 0: inherited at destination (no action)
        FROM item_membership
        WHERE item_path @> '${newParentItemPath}'
        GROUP BY account_id

        UNION ALL

        -- permissions to consider "at" the origin of the moving item
        ${getPermissionsAtItemSql(item.path, newParentItemPath, itemIdAsPath, parentItemPath)}
      ) AS t2
      ORDER BY account_id, nlevel(item_path), permission;
    `),
    );

    return (rows as unknown as MoveHousekeepingType[]).reduce<ResultMoveHousekeeping>(
      (changes, row) => {
        const { accountId, itemPath, permission, action, inherited, action2IgnoreInherited } = row;

        if (action === PermissionType.InheritedAtDestination) {
          return changes;
        }
        if (action === PermissionType.BellongsToTree && action2IgnoreInherited) {
          return changes;
        }

        // permission (inherited) at the "origin" better than inherited one at "destination"
        if (
          action === PermissionType.InheritedAtOrigin &&
          PermissionLevelCompare.gt(permission, inherited)
        ) {
          changes.inserts.push({
            accountId,
            itemPath,
            permission,
            creatorId: accountId,
          });
        }

        // permission worse or equal to inherited one at "destination"
        if (
          action === PermissionType.BellongsToTree &&
          PermissionLevelCompare.lte(permission, inherited)
        ) {
          changes.deletes.push({ accountId, itemPath });
        }

        return changes;
      },
      {
        inserts: [],
        deletes: [],
      },
    );
  }
}
