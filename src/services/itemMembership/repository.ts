import { Brackets, In, Not } from 'typeorm';

import { PermissionLevel, PermissionLevelCompare, UUID } from '@graasp/sdk';

import { AppDataSource } from '../../plugins/datasource';
import {
  InvalidMembership,
  InvalidPermissionLevel,
  ItemMembershipNotFound,
  ModifyExisting,
} from '../../util/graasp-error';
import { Item } from '../item/entities/Item';
import { pathToId } from '../item/utils';
import { Member } from '../member/entities/member';
import { mapById } from '../utils';
import { ItemMembership } from './entities/ItemMembership';
import { getPermissionsAtItemSql } from './utils';

export const ItemMembershipRepository = AppDataSource.getRepository(ItemMembership).extend({
  /**
   * Create multiple memberships given an array of partial membership objects.
   * @param memberships Array of objects with properties: `memberId`, `itemPath`, `permission`, `creator`
   * @param transactionHandler Database transaction handler
   */
  async createMany(memberships: Partial<ItemMembership>[]): Promise<ItemMembership[]> {
    return this.insert(memberships);
  },

  async deleteOne(itemMembershipId: string, args: { purgeBelow?: boolean } = { purgeBelow: true }) {
    const itemMembership = await this.get(itemMembershipId);

    if (args.purgeBelow) {
      const { item, member } = itemMembership;
      const itemMembershipsBelow = await this.getAllBelow(item, member.id);

      if (itemMembershipsBelow.length > 0) {
        // return list of subtasks for task manager to execute and
        // delete all memberships in the (sub)tree, one by one, in reverse order (bottom > top)
        await this.delete(itemMembershipsBelow.map(({ id }) => id));
      }
    }

    await this.delete(itemMembershipId);
    return itemMembership;
  },

  /**
   * Delete multiple memberships matching `memberId`+`itemPath`
   * from partial memberships in given array.
   * @param memberships List of objects with: `memberId`, `itemPath`
   * @param transactionHandler Database transaction handler
   */
  async deleteMany(memberships: Partial<ItemMembership>[]): Promise<readonly ItemMembership[]> {
    return this.delete(memberships);
  },

  async get(id: string) {
    const item = await this.findOne({
      where: { id },
      relations: {
        member: true,
        item: true,
      },
    });

    if (!item) {
      throw new ItemMembershipNotFound(id);
    }

    return item;
  },

  async getAllBelow(item: Item, memberId: string) {
    return this.createQueryBuilder('item_membership')
      .where('item_membership.member = :id', { id: memberId })
      .andWhere('item_membership.item_path <@ :path', { path: item.path })
      .andWhere('item_membership.item_path != :path', { path: item.path })
      .getMany();
  },

  async getForManyItems(items: Item[], memberId?: UUID) {
    const query = this.createQueryBuilder('item_membership')
      .leftJoinAndSelect('item_membership.item', 'item')
      .leftJoinAndSelect('item_membership.member', 'member');

    query.where(
      new Brackets((qb) => {
        items.forEach(({ path }, idx) => {
          // if (idx === 0) {
          //   qb.where(`item.path @> :path_${path}`, { [`path_${path}`]: path });
          // } else {
          qb.orWhere(`item.path @> :path_${path}`, { [`path_${path}`]: path });
          // }
        });
      }),
    );

    if (memberId) {
      query.andWhere('member.id = :memberId', { memberId });
    }

    const memberships = await query.getMany();

    const mapByPath = mapById({
      keys: items.map(({ path }) => path),
      findElement: (path) => memberships.filter(({ item }) => path.includes(item.path)),
      buildError: (path) => new ItemMembershipNotFound(path),
    });

    // use id as key
    const idToMemberships = Object.fromEntries(
      Object.entries(mapByPath.data).map(([key, value]) => [pathToId(key), value]),
    );

    return { data: idToMemberships, errors: mapByPath.errors };
  },

  // check member's membership "at" item
  async getInherited(item: Item, member: Member, considerLocal = false) {
    const query = this.createQueryBuilder('item_membership')
      .leftJoinAndSelect('item_membership.item', 'item')
      .leftJoinAndSelect('item_membership.member', 'member')
      .where('item_membership.member = :id', { id: member.id })
      .andWhere('item_membership.item_path @> :path', { path: item.path });

    if (!considerLocal) {
      query.andWhere('item_membership.item_path != :path', { path: item.path });
    }

    // .limit(1) -> getOne()
    const memberships = await query.orderBy('nlevel(item_membership.item_path)', 'DESC').getMany();

    // TODO: optimize
    // order by array https://stackoverflow.com/questions/866465/order-by-the-in-value-list
    // order by https://stackoverflow.com/questions/17603907/order-by-enum-field-in-mysql
    const result = memberships?.reduce((highest, m) => {
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
  },
  async getMany(ids: string[], args: { throwOnError?: boolean }) {
    const itemMemberships = await this.find({
      where: { id: In(ids) },
      relations: {
        member: true,
        item: true,
      },
    });

    const result = mapById({
      keys: ids,
      findElement: (id) => itemMemberships.find(({ id: thisId }) => id === thisId),
      buildError: (id) => new ItemMembershipNotFound(id),
    });

    if (args.throwOnError && result.errors.length) {
      throw result.errors[0];
    }

    return result;
  },

  async getSharedItems(actorId: UUID, permission?: PermissionLevel) {
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
    const sharedMemberships = await this.find({
      where: {
        permission: In(permissions),
        member: { id: actorId },
        item: { creator: Not(actorId) },
      },
      relations: ['item', 'item.creator'],
    });
    const items = sharedMemberships.map(({ item }) => item);
    // TODO: optimize
    // ignore children of shared parent
    return items.filter(({ path }) => {
      const hasParent = items.find((i) => path.includes(i.path + '.'));
      return !hasParent;
    });
  },

  async patch(itemMembershipId: string, data: { permission: PermissionLevel }) {
    const itemMembership = await this.findOne({
      where: { id: itemMembershipId },
      relations: { item: true, member: true },
    });
    // check member's inherited membership
    const { item, member: memberOfMembership } = itemMembership;

    const inheritedMembership = await this.getInherited(item, memberOfMembership);

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
    const membershipsBelow = await this.getAllBelow(item, memberOfMembership.id);
    let tasks: Promise<void>[] = [];
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

    tasks.push(this.update(itemMembershipId, { permission }));
    // TODO: optimize
    await Promise.all(tasks);

    return this.get(itemMembershipId);
  },

  async post(args: { item: Item; member: Member; creator: Member; permission: PermissionLevel }) {
    const { item, member, creator, permission } = args;
    // prepare membership but do not save it
    const itemMembership = this.create({
      permission,
      item,
      member,
      creator,
    });

    const inheritedMembership = await this.getInherited(item, member, true);

    if (inheritedMembership) {
      const { item: itemFromPermission, permission: inheritedPermission, id } = inheritedMembership;
      // fail if trying to add a new membership for the same member and item
      if (itemFromPermission.id === item.id) {
        throw new ModifyExisting(id);
      }

      if (PermissionLevelCompare.lte(permission, inheritedPermission)) {
        // trying to add a membership with the same or "worse" permission level than
        // the one inherited from the membership "above"
        throw new InvalidMembership({ itemId: item.id, memberId: member.id, permission });
      }
    }

    // check existing memberships lower in the tree
    const membershipsBelow = await this.getAllBelow(item, member.id);
    let tasks: Promise<void>[] = [];
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
    tasks.push(this.insert(itemMembership));

    await Promise.all(tasks);
    return itemMembership;
  },

  // UTILS

  /**
   * Identify any new memberships that will be necessary to create
   * after moving the item from its parent item to *no-parent*.
   *
   * Moving to *no-parent* is simpler so this method is used instead of `moveHousekeeping()`.
   * @param item Item that will be moved
   * @param member Member used as `creator` for any new memberships
   * @param transactionHandler Database transaction handler
   */
  // TODO: query type
  async detachedMoveHousekeeping(item: Item, member: Member) {
    const index = item.path.lastIndexOf('.');
    const itemIdAsPath = item.path.slice(index + 1);

    const { rows } = await this.query(`
    SELECT
      member_id AS "memberId",
      max(item_path::text)::ltree AS "itemPath", -- get longest path
      max(permission) AS permission -- get best permission
    FROM item_membership
    WHERE item_path @> '${item.path}'
    GROUP BY member_id
  `);

    const changes = {
      inserts: [] as Partial<ItemMembership>[],
      deletes: [] as Partial<ItemMembership>[],
    };

    rows?.reduce((chngs, row) => {
      const { memberId, itemPath, permission } = row;

      if (itemPath !== item.path) {
        chngs.inserts.push({
          memberId,
          itemPath: itemIdAsPath,
          permission,
          creator: member,
        } as Partial<ItemMembership>);
      }

      return chngs;
    }, changes);

    return changes;
  },

  /**
   * Identify any new memberships to be created, and any existing memberships to be
   * removed, after moving the item. These are adjustmnents necessary
   * to keep the constraints in the memberships:
   *
   * * members inherit membership permissions from memberships in items 'above'
   * * memberships 'down the tree' can only improve on the permission level and cannot repeat: read > write > admin
   *
   * ** Needs to run before the actual item move **
   * @param item Item that will be moved
   * @param member Member used as `creator` for any new memberships
   * @param newParentItem Parent item to where `item` will be moved to
   */
  async moveHousekeeping(
    item: Item,
    member: Member,
    newParentItem?: Item,
  ): Promise<{
    inserts: Partial<ItemMembership>[];
    deletes: Partial<ItemMembership>[];
  }> {
    if (!newParentItem) return this.detachedMoveHousekeeping(item, member);

    const { path: newParentItemPath } = newParentItem;
    const index = item.path.lastIndexOf('.');

    const parentItemPath = index > -1 ? item.path.slice(0, index) : undefined;
    const itemIdAsPath = index > -1 ? item.path.slice(index + 1) : item.path;

    const { rows } = await this.query(`
      SELECT
        member_id AS "memberId", item_path AS "itemPath", permission, action,
        first_value(permission) OVER (PARTITION BY member_id ORDER BY action) AS inherited,
        min(nlevel(item_path)) OVER (PARTITION BY member_id) > nlevel('${newParentItemPath}') AS "action2IgnoreInherited"
      FROM (
        -- "last" inherited permission, for each member, at the destination item
        SELECT
          member_id,
          '${newParentItemPath}'::ltree AS item_path,
          max(permission) AS permission,
          0 AS action -- 0: inherited at destination (no action)
        FROM item_membership
        WHERE item_path @> '${newParentItemPath}'
        GROUP BY member_id

        UNION ALL

        -- permissions to consider "at" the origin of the moving item
        ${getPermissionsAtItemSql(item.path, newParentItemPath, itemIdAsPath, parentItemPath)}
      ) AS t2
      ORDER BY member_id, nlevel(item_path), permission;
    `);

    const changes = {
      inserts: [] as Partial<ItemMembership>[],
      deletes: [] as Partial<ItemMembership>[],
    };

    rows?.reduce((chngs, row) => {
      const {
        memberId,
        itemPath,
        permission: p,
        action,
        inherited: ip,
        action2IgnoreInherited,
      } = row;

      if (action === 0) return chngs;
      if (action === 2 && action2IgnoreInherited) return chngs;

      const permission = p as PermissionLevel;
      const inherited = ip as PermissionLevel;

      // permission (inherited) at the "origin" better than inherited one at "destination"
      if (action === 1 && PermissionLevelCompare.gt(permission, inherited)) {
        chngs.inserts.push({
          memberId,
          itemPath,
          permission,
          creator: member,
        } as Partial<ItemMembership>);
      }

      // permission worse or equal to inherited one at "destination"
      if (action === 2 && PermissionLevelCompare.lte(permission, inherited)) {
        chngs.deletes.push({ memberId, itemPath } as Partial<ItemMembership>);
      }

      return chngs;
    }, changes);

    return changes;
  },
});
