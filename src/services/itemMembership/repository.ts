import { Brackets, EntityManager, In, Not } from 'typeorm';

import {
  Paginated,
  Pagination,
  PermissionLevel,
  PermissionLevelCompare,
  ResultOf,
  UUID,
  getChildFromPath,
} from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import { MutableRepository } from '../../repositories/MutableRepository';
import { DEFAULT_PRIMARY_KEY } from '../../repositories/const';
import { ALLOWED_SEARCH_LANGS } from '../../utils/config';
import {
  InvalidMembership,
  InvalidPermissionLevel,
  ItemMembershipNotFound,
  ItemNotFound,
  MemberNotFound,
  ModifyExistingMembership,
} from '../../utils/errors';
import { AncestorOf } from '../../utils/typeorm/treeOperators';
import { Account } from '../account/entities/account';
import { ITEMS_PAGE_SIZE_MAX } from '../item/constants';
import { Item } from '../item/entities/Item';
import { ItemSearchParams, Ordering, SortBy, orderingToUpperCase } from '../item/types';
import { MemberIdentifierNotFound } from '../itemLogin/errors';
import { isMember } from '../member/entities/member';
import { itemMembershipSchema } from '../member/plugins/export-data/schemas/schemas';
import { schemaToSelectMapper } from '../member/plugins/export-data/utils/selection.utils';
import { mapById } from '../utils';
import { ItemMembership } from './entities/ItemMembership';
import { PermissionType, getPermissionsAtItemSql } from './utils';

type ItemPath = Item['path'];
type AccountId = Account['id'];
type CreatorId = Account['id'];

type CreateItemMembershipBody = {
  itemPath: ItemPath;
  accountId: AccountId;
  creatorId?: CreatorId;
  permission: PermissionLevel;
};
type UpdateItemMembershipBody = { permission: PermissionLevel };
type KeyCompositionItemMembership = { itemPath: ItemPath; accountId: AccountId };
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

export class ItemMembershipRepository extends MutableRepository<
  ItemMembership,
  UpdateItemMembershipBody
> {
  constructor(manager?: EntityManager) {
    super(DEFAULT_PRIMARY_KEY, ItemMembership, manager);
  }

  async getOne(id: string): Promise<ItemMembership | null> {
    return await super.findOne(id, {
      relations: {
        creator: true,
        account: true,
        item: true,
      },
    });
  }

  /**
   * Create multiple memberships given an array of partial membership objects.
   * @param memberships Array of objects with properties: `memberId`, `itemPath`, `permission`, `creator`
   */
  async addMany(memberships: CreateItemMembershipBody[]): Promise<ItemMembership[]> {
    const itemsMemberships = memberships.map((m) =>
      this.repository.create({
        permission: m.permission,
        item: { id: getChildFromPath(m.itemPath), path: m.itemPath },
        account: { id: m.accountId },
        creator: { id: m.creatorId },
      }),
    );
    await this.repository.insert(itemsMemberships);
    return itemsMemberships;
  }

  async deleteOne(
    itemMembershipId: string,
    args: { purgeBelow?: boolean } = { purgeBelow: true },
  ): Promise<ItemMembership> {
    const itemMembership = await this.get(itemMembershipId);

    if (args.purgeBelow) {
      const { item, account } = itemMembership;
      const itemMembershipsBelow = await this.getAllBelow(item.path, account.id);

      if (itemMembershipsBelow.length > 0) {
        // return list of subtasks for task manager to execute and
        // delete all memberships in the (sub)tree, one by one, in reverse order (bottom > top)
        await this.delete(itemMembershipsBelow.map(({ id }) => id));
      }
    }

    await this.delete(itemMembershipId);
    return itemMembership;
  }

  /**
   * Delete multiple memberships matching `memberId`+`itemPath`
   * from partial memberships in given array.
   * @param composedKeys List of objects with: `accountId`, `itemPath`
   */
  async deleteManyByItemPathAndAccount(
    composedKeys: KeyCompositionItemMembership[],
  ): Promise<void> {
    for (const composedKey of composedKeys) {
      await this.repository.delete({
        item: { path: composedKey.itemPath },
        account: { id: composedKey.accountId },
      });
    }
  }

  async get(id: string): Promise<ItemMembership> {
    const item = await this.repository.findOne({
      where: { id },
      relations: ['account', 'item', 'item.creator'],
    });

    if (!item) {
      throw new ItemMembershipNotFound({ id });
    }

    return item;
  }

  async getByAccountAndItem(accountId: string, itemId: string): Promise<ItemMembership | null> {
    if (!accountId) {
      throw new MemberNotFound();
    } else if (!itemId) {
      throw new ItemNotFound(itemId);
    }

    return await this.repository.findOne({
      where: {
        account: { id: accountId },
        item: { id: itemId },
      },
      relations: {
        account: true,
        item: true,
      },
    });
  }

  /**
   * Return membership under given item (without self memberships)
   * @param item
   * @param accountId
   * @returns
   */
  async getAllBelow(
    itemPath: ItemPath,
    accountId?: string,
    {
      considerLocal = false,
      selectItem = false,
    }: { considerLocal?: boolean; selectItem?: boolean } = {},
  ): Promise<ItemMembership[]> {
    const query = this.repository
      .createQueryBuilder('item_membership')
      .andWhere('item_membership.item_path <@ :path', { path: itemPath });

    if (!considerLocal) {
      query.andWhere('item_membership.item_path != :path', { path: itemPath });
    }

    // if member is specified, select only this user
    if (accountId) {
      query.andWhere('item_membership.account = :id', { id: accountId });
    }
    // otherwise return members' info
    else {
      query.leftJoinAndSelect('item_membership.account', 'account');
    }

    if (selectItem) {
      query.leftJoinAndSelect('item_membership.item', 'item');
    }

    return query.getMany();
  }

  /**
   *  get accessible items for actor and given params
   *  */
  async getAccessibleItems(
    account: Account,
    {
      creatorId,
      keywords,
      sortBy = SortBy.ItemUpdatedAt,
      ordering = Ordering.DESC,
      permissions,
      types,
    }: ItemSearchParams,
    pagination: Pagination,
  ): Promise<Paginated<ItemMembership>> {
    const { page, pageSize } = pagination;
    const limit = Math.min(pageSize, ITEMS_PAGE_SIZE_MAX);
    const skip = (page - 1) * limit;

    const query = this.repository
      .createQueryBuilder('im')
      .leftJoinAndSelect('im.item', 'item')
      .leftJoinAndSelect('item.creator', 'creator')
      .where('im.account_id = :actorId', { actorId: account.id })
      // returns only top most item
      .andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .from(ItemMembership, 'im1')
          .select('im1.item.path')
          .where('im.item_path <@ im1.item_path')
          .andWhere('im1.account_id = :actorId', { actorId: account.id })
          .orderBy('im1.item_path', 'ASC')
          .limit(1);

        if (permissions) {
          subQuery.andWhere('im1.permission IN (:...permissions)', { permissions });
        }
        return 'item.path =' + subQuery.getQuery();
      });

    const allKeywords = keywords?.filter((s) => s && s.length);
    if (allKeywords?.length) {
      const keywordsString = allKeywords.join(' ');
      query.andWhere(
        new Brackets((q) => {
          // search in english by default
          q.where("item.search_document @@ plainto_tsquery('english', :keywords)", {
            keywords: keywordsString,
          });

          // no dictionary
          q.orWhere("item.search_document @@ plainto_tsquery('simple', :keywords)", {
            keywords: keywordsString,
          });

          // raw words search
          allKeywords.forEach((k, idx) => {
            q.orWhere(`item.name ILIKE :k_${idx}`, {
              [`k_${idx}`]: `%${k}%`,
            });
          });

          // search by member lang
          const memberLang = isMember(account) ? account.lang : DEFAULT_LANG;
          if (memberLang != DEFAULT_LANG && ALLOWED_SEARCH_LANGS[memberLang]) {
            q.orWhere('item.search_document @@ plainto_tsquery(:lang, :keywords)', {
              keywords: keywordsString,
              lang: ALLOWED_SEARCH_LANGS[memberLang],
            });
          }
        }),
      );
    }

    if (creatorId) {
      query.andWhere('item.creator = :creatorId', { creatorId });
    }

    if (permissions) {
      query.andWhere('im.permission IN (:...permissions)', { permissions });
    }

    if (types) {
      query.andWhere('item.type IN (:...types)', { types });
    }

    if (sortBy) {
      // map strings to correct sort by column
      let mappedSortBy;
      switch (sortBy) {
        case SortBy.ItemType:
          mappedSortBy = 'item.type';
          break;
        case SortBy.ItemUpdatedAt:
          mappedSortBy = 'item.updated_at';
          break;
        case SortBy.ItemCreatedAt:
          mappedSortBy = 'item.created_at';
          break;
        case SortBy.ItemCreatorName:
          mappedSortBy = 'creator.name';
          break;
        case SortBy.ItemName:
          mappedSortBy = 'item.name';
          break;
      }
      if (mappedSortBy) {
        query.orderBy(mappedSortBy, orderingToUpperCase(ordering));
      }
    }

    const [im, totalCount] = await query.offset(skip).limit(limit).getManyAndCount();
    return { data: im, totalCount, pagination };
  }

  /**
   *  get accessible items name for actor and given params
   *  */
  async getAccessibleItemNames(
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
      query = query.andWhere('item.name ILIKE :startWith', { startWith: `${startWith}%` });
    }
    const raw = await query.getRawMany();
    return raw.map(({ item_name }) => item_name);
  }

  /**
   * Return all the memberships related to the given account.
   * @param accountId ID of the account to retrieve the data.
   * @returns an array of memberships.
   */
  async getForMemberExport(accountId: string): Promise<ItemMembership[]> {
    if (!accountId) {
      throw new MemberIdentifierNotFound();
    }

    return this.repository.find({
      select: schemaToSelectMapper(itemMembershipSchema),
      where: { account: { id: accountId } },
      order: { updatedAt: 'DESC' },
      relations: {
        item: true,
      },
    });
  }

  async getForManyItems(
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
    ids: string[],
    args: { throwOnError?: boolean } = { throwOnError: false },
  ): Promise<ResultOf<ItemMembership>> {
    const itemMemberships = await this.repository.find({
      where: { id: In(ids) },
      relations: {
        account: true,
        item: true,
      },
    });

    const result = mapById({
      keys: ids,
      findElement: (id) => itemMemberships.find(({ id: thisId }) => id === thisId),
      buildError: (id) => new ItemMembershipNotFound({ id }),
    });

    if (args.throwOnError && result.errors.length) {
      throw result.errors[0];
    }

    return result;
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
    const sharedMemberships = await this.repository.find({
      where: {
        permission: In(permissions),
        account: { id: actorId },
        item: { creator: Not(actorId) },
      },
      relations: {
        item: {
          creator: true,
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
    itemPath: string,
    permission: PermissionLevel,
  ): Promise<ItemMembership[]> {
    return this.repository.find({
      where: { item: AncestorOf(itemPath), permission },
      relations: {
        account: true,
      },
    });
  }

  async updateOne(
    itemMembershipId: string,
    data: UpdateItemMembershipBody,
  ): Promise<ItemMembership> {
    const itemMembership = await this.get(itemMembershipId);
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
    const membershipsBelow = await this.getAllBelow(item.path, memberOfMembership.id);
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

  async addOne({
    itemPath,
    accountId,
    creatorId,
    permission,
  }: CreateItemMembershipBody): Promise<ItemMembership> {
    // prepare membership but do not save it
    const itemId = getChildFromPath(itemPath);

    const inheritedMembership = await this.getInherited(itemPath, accountId, true);
    if (inheritedMembership) {
      const { item: itemFromPermission, permission: inheritedPermission, id } = inheritedMembership;
      // fail if trying to add a new membership for the same member and item
      if (itemFromPermission.id === itemId) {
        throw new ModifyExistingMembership({ id });
      }

      if (PermissionLevelCompare.lte(permission, inheritedPermission)) {
        // trying to add a membership with the same or "worse" permission level than
        // the one inherited from the membership "above"
        throw new InvalidMembership({ itemId: itemId, accountId: accountId, permission });
      }
    }

    // check existing memberships lower in the tree
    const membershipsBelow = await this.getAllBelow(itemPath, accountId);
    let tasks: Promise<unknown>[] = [];
    if (membershipsBelow.length > 0) {
      // check if any have the same or a worse permission level
      const membershipsBelowToDiscard = membershipsBelow.filter((m) =>
        PermissionLevelCompare.lte(m.permission, permission),
      );

      if (membershipsBelowToDiscard.length > 0) {
        // remove redundant existing memberships and to create the new one
        tasks = membershipsBelowToDiscard.map(async (membership) => {
          await this.delete(membership.id);
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
