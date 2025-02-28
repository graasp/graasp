import { inArray, isNotNull, ne } from 'drizzle-orm';
import { and, eq, sql } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { PermissionLevel, PermissionLevelCompare, getChildFromPath } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import { isAncestorOrSelf, isDescendantOrSelf } from '../../drizzle/operations';
import {
  Account,
  ItemMembership,
  itemMemberships as itemMembershipTable,
  items,
} from '../../drizzle/schema';
import {
  InvalidMembership,
  InvalidPermissionLevel,
  ItemMembershipNotFound,
  ItemNotFound,
  MemberNotFound,
  ModifyExistingMembership,
} from '../../utils/errors';
import { Item } from '../item/entities/Item';
import { mapById } from '../utils';
import { PermissionType, getPermissionsAtItemSql } from './utils';

type ItemPath = Item['path'];
type AccountId = Account['id'];
type CreatorId = Account['id'];

type CreateItemMembershipBody = {
  itemPath: ItemPath;
  accountId: AccountId;
  creatorId?: CreatorId;
  permission: `${PermissionLevel}`;
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
  async getOne(db: DBConnection, id: string): Promise<ItemMembership | undefined> {
    const res = await db.query.itemMemberships.findFirst({
      where: eq(itemMembershipTable.id, id),
      with: { creator: true, item: true, account: true },
    });
    return res;
  }

  /**
   * Create multiple memberships given an array of partial membership objects.
   * @param memberships Array of objects with properties: `memberId`, `itemPath`, `permission`, `creator`
   */
  async addMany(db: DBConnection, memberships: CreateItemMembershipBody[]) {
    const itemsMemberships = await db
      .insert(itemMembershipTable)
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
    db: DBConnection,
    itemMembershipId: string,
    args: { purgeBelow?: boolean } = { purgeBelow: true },
  ): Promise<ItemMembership> {
    const itemMembership = await db.query.itemMemberships.findFirst({
      where: eq(itemMembershipTable.id, itemMembershipId),
    });
    if (!itemMembership) {
      throw new ItemMembershipNotFound();
    }

    if (args.purgeBelow) {
      const { itemPath, accountId } = itemMembership;
      const itemMembershipsBelow = await this.getAllBellowItemPathForAccount(
        db,
        itemPath,
        accountId,
      );

      if (itemMembershipsBelow.length > 0) {
        // return list of subtasks for task manager to execute and
        // delete all memberships in the (sub)tree, one by one, in reverse order (bottom > top)
        await db.delete(itemMembershipTable).where(
          inArray(
            itemMembershipTable.id,
            itemMembershipsBelow.map(({ id }) => id),
          ),
        );
      }
    }
    await db.delete(itemMembershipTable).where(eq(itemMembershipTable.id, itemMembershipId));
    return itemMembership;
  }

  /**
   * Delete multiple memberships matching `memberId`+`itemPath`
   * from partial memberships in given array.
   * @param composedKeys List of objects with: `accountId`, `itemPath`
   */
  async deleteManyByItemPathAndAccount(
    db: DBConnection,
    composedKeys: {
      itemPath: ItemPath;
      accountId: AccountId;
    }[],
  ): Promise<void> {
    for (const { itemPath, accountId } of composedKeys) {
      await db
        .delete(itemMembershipTable)
        .where(
          and(
            eq(itemMembershipTable.itemPath, itemPath),
            eq(itemMembershipTable.accountId, accountId),
          ),
        );
    }
  }

  async get(db: DBConnection, id: string) {
    const item = await db.query.itemMemberships.findFirst({
      where: eq(itemMembershipTable.id, id),
      with: { account: true, item: { with: { account: true } } },
    });

    if (!item) {
      throw new ItemMembershipNotFound({ id });
    }

    return item;
  }

  /**
   *
   * @param db Database connection or transaction connection
   * @param accountId the user id
   * @param itemId the itemId that we are testing for membership
   * @returns true if the user has a membership (direct or inherited) for the itemId, false otherwise
   */
  async hasMembershipOnItem(db: DBConnection, accountId: string, itemId: string): Promise<boolean> {
    if (!accountId) {
      throw new MemberNotFound();
    } else if (!itemId) {
      throw new ItemNotFound(itemId);
    }

    const res = await db
      .select({ id: itemMembershipTable.id })
      .from(itemMembershipTable)
      .leftJoin(items, eq(items.path, itemMembershipTable.itemPath))
      // TODO: we should probably check for ancestors of the item with itemId input to have a membership.
      .where(and(eq(itemMembershipTable.accountId, accountId), eq(items.id, itemId)));
    // we were able to get a result, so the accountId has a membership on the item
    if (res.length >= 1) {
      return true;
    }
    return false;
  }

  async getByAccountAndItemPath(
    db: DBConnection,
    accountId: string,
    itemPath: string,
  ): Promise<ItemMembership | undefined> {
    if (!accountId) {
      throw new MemberNotFound();
    } else if (!itemPath) {
      throw new ItemNotFound(itemPath);
    }

    // CHECK: does it need to take into account inheritance ?
    return await db.query.itemMemberships.findFirst({
      where: and(
        eq(itemMembershipTable.accountId, accountId),
        eq(itemMembershipTable.itemPath, itemPath),
      ),
      with: {
        account: true,
        item: true,
      },
    });
  }

  async getAllBellowItemPath(db: DBConnection, itemPath: ItemPath) {
    const membershipsBelowItemPath = db.query.itemMemberships.findMany({
      where: sql`${itemMembershipTable.itemPath} <@ ${itemPath}`,
      with: { account: true },
    });
    return membershipsBelowItemPath;
  }

  async getAllBellowItemPathForAccount(db: DBConnection, itemPath: ItemPath, accountId: string) {
    const membershipsBelowItemPath = db.query.itemMemberships.findMany({
      where: and(
        sql`${itemMembershipTable.itemPath} <@ ${itemPath}`,
        eq(itemMembershipTable.accountId, accountId),
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
    db: DBConnection,
    itemPath: ItemPath,
    accountId: string,
    {
      considerLocal = false,
      selectItem = false,
    }: { considerLocal?: boolean; selectItem?: boolean } = {},
  ): Promise<ItemMembership[]> {
    const andConditions = [
      isDescendantOrSelf(itemMembershipTable.itemPath, itemPath),
      eq(itemMembershipTable.accountId, accountId),
    ];

    if (!considerLocal) {
      andConditions.push(ne(itemMembershipTable.itemPath, itemPath));
    }

    return await db.query.itemMemberships.findMany({
      where: and(...andConditions),
      with: {
        item: selectItem ? true : undefined,
      },
    });
  }

  // /**
  //  *  get accessible items for actor and given params
  //  *  */
  // async getAccessibleItems(
  //   db: DBConnection,
  //   account: Account,
  //   {
  //     creatorId,
  //     keywords,
  //     sortBy = SortBy.ItemUpdatedAt,
  //     ordering = Ordering.DESC,
  //     permissions,
  //     types,
  //   }: ItemSearchParams,
  //   pagination: Pagination,
  // ): Promise<Paginated<ItemMembership>> {
  //   const { page, pageSize } = pagination;
  //   const limit = Math.min(pageSize, ITEMS_PAGE_SIZE_MAX);
  //   const skip = (page - 1) * limit;

  //   db.query.itemMemberships.findFirst({
  //     columns: {},
  //   });

  //   const query = await db
  //     .select()
  //     .from(itemMembershipTable)
  //     .leftJoin(items, eq(itemMembershipTable.itemPath, items.path))
  //     .leftJoin(membersView, eq(membersView.id, items.creatorId))
  //     .where(eq(itemMembershipTable.accountId, account.id))
  //     // returns only top most item
  //     .andWhere((qb) => {
  //       const subQuery = qb
  //         .subQuery()
  //         .from(itemMembershipTable, 'im1')
  //         .select('im1.item.path')
  //         .where('im.item_path <@ im1.item_path')
  //         .andWhere('im1.account_id = :actorId', { actorId: account.id })
  //         .orderBy('im1.item_path', 'ASC')
  //         .limit(1);

  //       if (permissions) {
  //         subQuery.andWhere('im1.permission IN (:...permissions)', { permissions });
  //       }
  //       return 'item.path =' + subQuery.getQuery();
  //     });

  //   const allKeywords = keywords?.filter((s) => s && s.length);
  //   if (allKeywords?.length) {
  //     const keywordsString = allKeywords.join(' ');
  //     query.andWhere(
  //       new Brackets((q) => {
  //         // search in english by default
  //         q.where("item.search_document @@ plainto_tsquery('english', :keywords)", {
  //           keywords: keywordsString,
  //         });

  //         // no dictionary
  //         q.orWhere("item.search_document @@ plainto_tsquery('simple', :keywords)", {
  //           keywords: keywordsString,
  //         });

  //         // raw words search
  //         allKeywords.forEach((k, idx) => {
  //           q.orWhere(`item.name ILIKE :k_${idx}`, {
  //             [`k_${idx}`]: `%${k}%`,
  //           });
  //         });

  //         // search by member lang
  //         const memberLang = isMember(account) ? account.lang : DEFAULT_LANG;
  //         const memberLangKey = memberLang as keyof typeof ALLOWED_SEARCH_LANGS;
  //         if (memberLang != DEFAULT_LANG && ALLOWED_SEARCH_LANGS[memberLangKey]) {
  //           q.orWhere('item.search_document @@ plainto_tsquery(:lang, :keywords)', {
  //             keywords: keywordsString,
  //             lang: ALLOWED_SEARCH_LANGS[memberLangKey],
  //           });
  //         }
  //       }),
  //     );
  //   }

  //   if (creatorId) {
  //     query.andWhere('item.creator = :creatorId', { creatorId });
  //   }

  //   if (permissions) {
  //     query.andWhere('im.permission IN (:...permissions)', { permissions });
  //   }

  //   if (types) {
  //     query.andWhere('item.type IN (:...types)', { types });
  //   }

  //   if (sortBy) {
  //     // map strings to correct sort by column
  //     let mappedSortBy;
  //     switch (sortBy) {
  //       case SortBy.ItemType:
  //         mappedSortBy = 'item.type';
  //         break;
  //       case SortBy.ItemUpdatedAt:
  //         mappedSortBy = 'item.updated_at';
  //         break;
  //       case SortBy.ItemCreatedAt:
  //         mappedSortBy = 'item.created_at';
  //         break;
  //       case SortBy.ItemCreatorName:
  //         mappedSortBy = 'creator.name';
  //         break;
  //       case SortBy.ItemName:
  //         mappedSortBy = 'item.name';
  //         break;
  //     }
  //     if (mappedSortBy) {
  //       query.orderBy(mappedSortBy, orderingToUpperCase(ordering));
  //     }
  //   }

  //   const [im, totalCount] = await query.offset(skip).limit(limit).getManyAndCount();
  //   return { data: im, totalCount, pagination };
  // }

  /**
   *  get accessible items name for actor and given params
   *  */
  async getAccessibleItemNames(
    db: DBConnection,
    actor: Account,
    { startWith }: { startWith?: string },
  ): Promise<string[]> {
    let query = this.repository
      .createQueryBuilder('im')
      .select('item.name')
      .leftJoin('im.item', 'item')
      .leftJoin('item.creator', 'creator')
      .where('im.account_id = :actorId', { actorId: actor.id })
      // returns only top most item
      .andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .from(ItemMembership, 'im1')
          .select('im1.item.path')
          .where('im.item_path <@ im1.item_path')
          .andWhere('im1.account_id = :actorId', { actorId: actor.id })
          .orderBy('im1.item_path', 'ASC')
          .limit(1);
        return 'item.path =' + subQuery.getQuery();
      });

    if (startWith) {
      query = query.andWhere('item.name ILIKE :startWith', {
        startWith: `${startWith}%`,
      });
    }
    const raw = await query.getRawMany();
    return raw.map(({ item_name }) => item_name);
  }

  async getForManyItems(
    db: DBConnection,
    items: Item[],
    {
      accountId = undefined,
      withDeleted = false,
    }: { accountId?: UUID; withDeleted?: boolean } = {},
  ): Promise<ResultOf<ItemMembership[]>> {
    if (items.length === 0) {
      return { data: {}, errors: [] };
    }

    const ids = items.map((i) => i.id);
    const query = this.repository.createQueryBuilder('item_membership');

    if (withDeleted) {
      query.withDeleted();
    }

    query
      .innerJoin('item', 'descendant', 'item_membership.item_path @> descendant.path')
      .where('descendant.id in (:...ids)', { ids });
    if (accountId) {
      query.andWhere('account.id = :accountId', { accountId });
    }

    query
      .leftJoinAndSelect('item_membership.item', 'item')
      .leftJoinAndSelect('item_membership.account', 'account');

    const memberships = await query.getMany();

    const mapByPath = mapById({
      keys: items.map(({ path }) => path),
      findElement: (path) => memberships.filter(({ item }) => path.includes(item.path)),
      buildError: (path) => new ItemMembershipNotFound({ path }),
    });

    // use id as key
    const idToMemberships = Object.fromEntries(
      Object.entries(mapByPath.data).map(([key, value]) => [getChildFromPath(key), value]),
    );

    return { data: idToMemberships, errors: mapByPath.errors };
  }

  async getInheritedMany(
    db: DBConnection,
    items: Item[],
    accountId: AccountId,
    considerLocal = false,
  ): Promise<ResultOf<ItemMembership>> {
    if (items.length === 0) {
      return { data: {}, errors: [] };
    }

    const ids = items.map((i) => i.id);

    const query = this.repository
      .createQueryBuilder('item_membership')
      // Map each membership to the item it can affect
      .innerJoin('item', 'descendant', 'item_membership.item_path @> descendant.path')
      // Join for entity result
      .leftJoinAndSelect('item_membership.account', 'account')
      .leftJoinAndSelect('item_membership.item', 'item')
      // Only from input
      .where('descendant.id in (:...ids)', { ids: ids })
      .andWhere('item_membership.account = :id', { id: accountId });
    if (!considerLocal) {
      query.andWhere('item.id not in (:...ids)', { ids: ids });
    }
    // Keep only closest membership per descendant
    query
      .addSelect('descendant.id')
      .distinctOn(['descendant.id'])
      .orderBy('descendant.id')
      .addOrderBy('nlevel(item_membership.item_path)', 'DESC');

    // annoyingly, getMany removes duplicate entities, however in this case two items might be linked to the same effective membership
    const memberships = await query.getRawAndEntities();

    // map entities by id to avoid iterating on the result multiple times
    const entityMap = new Map(memberships.entities.map((e) => [e.id, e]));
    const itemIdToMemberships = new Map(
      memberships.raw.map((e) => [e.descendant_id, entityMap.get(e.item_membership_id)]),
    ); // unfortunately we lose type safety because of the raw

    const result = mapById({
      keys: ids,
      findElement: (id) => itemIdToMemberships.get(id),
      buildError: (id) => new ItemMembershipNotFound({ id }),
    });

    return result;
  }

  /** check member's membership "at" item */
  async getInherited(
    db: DBConnection,
    itemPath: ItemPath,
    accountId: AccountId,
    considerLocal = false,
  ): Promise<ItemMembership | null> {
    const query = this.repository
      .createQueryBuilder('item_membership')
      .leftJoinAndSelect('item_membership.item', 'item')
      .leftJoinAndSelect('item_membership.account', 'account')
      .where('item_membership.account = :id', { id: accountId })
      .andWhere('item_membership.item_path @> :path', { path: itemPath });

    if (!considerLocal) {
      query.andWhere('item_membership.item_path != :path', { path: itemPath });
    }

    // .limit(1) -> getOne()
    const memberships = await query.orderBy('nlevel(item_membership.item_path)', 'DESC').getMany();

    // TODO: optimize
    // order by array https://stackoverflow.com/questions/866465/order-by-the-in-value-list
    // order by https://stackoverflow.com/questions/17603907/order-by-enum-field-in-mysql
    const result = memberships?.reduce((highest: ItemMembership | null, m: ItemMembership) => {
      if (PermissionLevelCompare.gte(m.permission, highest?.permission ?? PermissionLevel.Read)) {
        return m;
      }
      return highest;
    }, null);

    if (result) {
      return result;
    }

    // no membership in the tree
    return null;
  }

  async getMany(
    db: DBConnection,
    ids: string[],
    args: { throwOnError?: boolean } = { throwOnError: false },
  ): Promise<ResultOf<ItemMembership>> {
    const result = await db.query.itemMemberships.findMany({
      where: inArray(itemMembershipTable.id, ids),
      with: {
        account: true,
        item: true,
      },
    });

    const mappedMemberships = mapById({
      keys: ids,
      findElement: (id) => result.find(({ id: thisId }) => id === thisId),
      buildError: (id) => new ItemMembershipNotFound({ id }),
    });

    if (args.throwOnError && mappedMemberships.errors.length) {
      throw mappedMemberships.errors[0];
    }

    return mappedMemberships;
  }

  async getSharedItems(actorId: UUID, permission?: PermissionLevel): Promise<Item[]> {
    // TODO: refactor
    let permissions: PermissionLevel[];
    switch (permission) {
      case PermissionLevel.Admin:
        permissions = [PermissionLevel.Admin];
        break;
      case PermissionLevel.Write:
        permissions = [PermissionLevel.Write, PermissionLevel.Admin];
        break;
      case PermissionLevel.Read:
      default:
        permissions = Object.values(PermissionLevel);
        break;
    }

    // get items with given permission, without own items
    const sharedMemberships = await db.query.itemMemberships.findMany({
      where: and(
        inArray(itemMembershipTable.permission, permissions),
        eq(itemMembershipTable.accountId, actorId),
      ),
      with: {
        item: {
          where: (item) => and(isNotNull(item.creatorId), ne(item.creatorId, actorId)),
        },
      },
    });
    const items = sharedMemberships.map(({ item }) => item);
    // TODO: optimize
    // ignore children of shared parent
    return items.filter(({ path }) => {
      const hasParent = items.find((i) => path.includes(i.path + '.'));
      return !hasParent;
    });
  }

  async getByItemPathAndPermission(
    db: DBConnection,
    itemPath: string,
    permission: PermissionLevel,
  ): Promise<ItemMembership[]> {
    return await db.query.itemMemberships.findMany({
      where: and(
        isAncestorOrSelf(itemMembershipTable.itemPath, itemPath),
        eq(itemMembershipTable.permission, permission),
      ),
      with: {
        account: true,
      },
    });
  }

  async updateOne(
    db: DBConnection,
    itemMembershipId: string,
    data: UpdateItemMembershipBody,
  ): Promise<ItemMembership> {
    const itemMembership = await this.get(db, itemMembershipId);
    // check member's inherited membership
    const { item, account: memberOfMembership } = itemMembership;

    const inheritedMembership = await this.getInherited(item.path, memberOfMembership.id);

    const { permission } = data;
    if (inheritedMembership) {
      const { permission: inheritedPermission } = inheritedMembership;

      if (permission === inheritedPermission) {
        // downgrading to same as the inherited, delete current membership
        await this.delete(itemMembership.id);
        return inheritedMembership;
      } else if (PermissionLevelCompare.lt(permission, inheritedPermission)) {
        // if downgrading to "worse" than inherited
        throw new InvalidPermissionLevel(itemMembershipId);
      }
    }

    // check existing memberships lower in the tree
    const membershipsBelow = await this.getAllBellowItemPathForAccount(
      db,
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
        tasks = membershipsBelowToDiscard.map(async (m) => await this.delete(m.id));
      }
    }

    tasks.push(this.repository.update(itemMembershipId, { permission }));
    // TODO: optimize
    await Promise.all(tasks);

    return this.get(itemMembershipId);
  }

  async addOne(
    db: DBConnection,
    { itemPath, accountId, creatorId, permission }: CreateItemMembershipBody,
  ): Promise<ItemMembership> {
    // prepare membership but do not save it
    const itemId = getChildFromPath(itemPath);

    const inheritedMembership = await this.getInherited(db, itemPath, accountId, true);
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
    const membershipsBelow = await this.getAllBelow(db, itemPath, accountId);
    let tasks: Promise<unknown>[] = [];
    if (membershipsBelow.length > 0) {
      // check if any have the same or a worse permission level
      const membershipsBelowToDiscard = membershipsBelow.filter((m) =>
        PermissionLevelCompare.lte(m.permission, permission),
      );

      if (membershipsBelowToDiscard.length > 0) {
        // remove redundant existing memberships and to create the new one
        tasks = membershipsBelowToDiscard.map(async (membership) => {
          await this.delete(db, membership.id);
        });
      }
    }

    // create new membership
    const itemMembership = await this.insert({
      permission,
      item: { id: itemId, path: itemPath },
      account: { id: accountId },
      creator: { id: creatorId },
    });
    await Promise.all(tasks);

    return itemMembership;
  }

  // UTILS

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
  async detachedMoveHousekeeping(item: Item, account: Account) {
    // Get the Id of the item when it will be moved to the root
    const index = item.path.lastIndexOf('.');
    const itemIdAsPath = item.path.slice(index + 1);

    // For each account that belongs to an ancestor of the element,
    // retrieve its best permission and the path to the deepest element (closest to the element).
    const rows = (await this.repository
      .createQueryBuilder('item_membership')
      .select('account_id', 'accountId')
      .addSelect('max(item_path::text)::ltree', 'itemPath') // Get the longest path
      .addSelect('max(permission)', 'permission') // Get the best permission
      .where('item_path @> :path', { path: item.path })
      .groupBy('account_id')
      .getRawMany()) as DetachedMoveHousekeepingType[];

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
  async moveHousekeeping(item: Item, account: Account, newParentItem?: Item) {
    if (!newParentItem) {
      // Moving to the root
      return this.detachedMoveHousekeeping(item, account);
    }

    const { path: newParentItemPath } = newParentItem;
    const index = item.path.lastIndexOf('.');

    // If the a '.' has been found (>= 0) in item's path, this means that it has a parent.
    // parentItemPath is the path of the direct parent item
    const parentItemPath = index >= 0 ? item.path.slice(0, index) : undefined;
    // itemIdAsPath is the path of the item without any parent
    const itemIdAsPath = index >= 0 ? item.path.slice(index + 1) : item.path;

    const rows = (await this.repository.query(`
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
    `)) as MoveHousekeepingType[];

    return rows.reduce<ResultMoveHousekeeping>(
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
