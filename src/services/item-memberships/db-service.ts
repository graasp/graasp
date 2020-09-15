// global
import { sql, DatabaseTransactionConnectionType as TrxHandler } from 'slonik';
// other services
import { Item } from 'services/items/interfaces/item';
import { Member } from 'services/members/interfaces/member';
// local
import { ItemMembership, PermissionLevel, PermissionLevelCompare } from './interfaces/item-membership';

export class ItemMembershipService {
  // the 'safe' way to dynamically generate the columns names:
  private static allColumns = sql.join(
    [
      'id',
      ['member_id', 'memberId'],
      ['item_path', 'itemPath'],
      'permission',
      'creator',
      ['created_at', 'createdAt'],
      ['updated_at', 'updatedAt']
    ].map(c =>
      !Array.isArray(c) ?
        sql.identifier([c]) :
        sql.join(c.map(cwa => sql.identifier([cwa])), sql` AS `)
    ),
    sql`, `
  );

  /**
   * Get the permission level of a membership given the `member` and `item`.
   * @param member Member in membership
   * @param item Item whose path is referenced in membership
   * @param transactionHandler Database transaction handler
   */
  async getPermissionLevel(member: Member, item: Item, transactionHandler: TrxHandler) {
    return transactionHandler.query<ItemMembership>(sql`
        SELECT permission FROM item_membership
        WHERE member_id = ${member.id}
          AND item_path @> ${item.path}
        ORDER BY nlevel(item_path) DESC
        LIMIT 1
      `)
      .then(({ rows, rowCount }) => rowCount ? rows[0].permission : null);
  }

  /**
   * Get the 'best/nearest' membership to the given `item` for `member`.
   * If `excludeOwn`, ignores membership targeting this `member`+`item`.
   * @param member Member in membership
   * @param item Item whose path should be considered
   * @param transactionHandler Database transaction handler
   * @param excludeOwn Exclude membership targeting the given pair member+item
   */
  async getInherited(member: Member, item: Item, transactionHandler: TrxHandler, excludeOwn = false) {
    return transactionHandler.query<ItemMembership>(sql`
        SELECT ${ItemMembershipService.allColumns}
        FROM item_membership
        WHERE member_id = ${member.id}
          AND item_path @> ${item.path}
          ${ excludeOwn ? sql`AND item_path != ${item.path}` : sql``}
        ORDER BY nlevel(item_path) DESC
        LIMIT 1
      `)
      .then(({ rows }) => rows[0] || null);
  }

  /**
   * Get all memberships "below" the given `membership`, ordered by longest to shortest
   * path - lowest in the (sub)tree to highest in the (sub)tree.
   * @param membership Membership
   * @param transactionHandler Database transaction handler
   */
  async getAllBelow(membership: ItemMembership, transactionHandler: TrxHandler) {
    return transactionHandler.query<Partial<ItemMembership>>(sql`
        SELECT id
        FROM item_membership
        WHERE member_id = ${membership.memberId}
          AND ${membership.itemPath} @> item_path
          AND id != ${membership.id}
        ORDER BY nlevel(item_path) DESC
      `)
      .then(({ rows }) => rows.slice(0));
  }

  /**
   * Get all the 'best/nearest' memberships for the given `item` for each member
   * with access to it.
   * @param item Item whose path should be considered
   * @param transactionHandler Database transaction handler
   */
  async getInheritedForAll(item: Item, transactionHandler: TrxHandler) {
    return transactionHandler.query<ItemMembership>(sql`
        SELECT ${ItemMembershipService.allColumns}
        FROM (
          SELECT *,
            RANK() OVER (PARTITION BY member_id ORDER BY nlevel(item_path) DESC) AS membership_rank
          FROM item_membership
          WHERE item_path @> ${item.path}
        ) AS t1
        WHERE membership_rank = 1
      `)
      .then(({ rows }) => rows.slice(0));
  }

  /**
   * Check if given `member` can `read` given `item`.
   * @param member Member
   * @param item Item
   * @param transactionHandler Database transaction handler
   */
  async canRead(member: Member, item: Item, transactionHandler: TrxHandler) {
    return this.getPermissionLevel(member, item, transactionHandler)
      .then(Boolean);  // if any permission exists it means the member can read the item
  }

  /**
   * Check if given `member` can `write` given `item`.
   * @param member Member
   * @param item Item
   * @param transactionHandler Database transaction handler
   */
  async canWrite(member: Member, item: Item, transactionHandler: TrxHandler) {
    return this.getPermissionLevel(member, item, transactionHandler)
      .then(p => p === PermissionLevel.Write || p === PermissionLevel.Admin);
  }

  /**
   * Check if given `member` can `admin` given `item`.
   * @param member Member
   * @param item Item
   * @param transactionHandler Database transaction handler
   */
  async canAdmin(member: Member, item: Item, transactionHandler: TrxHandler) {
    return this.getPermissionLevel(member, item, transactionHandler)
      .then(p => p === PermissionLevel.Admin);
  }

  /**
   * Get membership by its `id`.
   * @param id Membership unique id
   * @param transactionHandler Database transaction handler
   */
  async get(id: string, transactionHandler: TrxHandler) {
    return transactionHandler.query<ItemMembership>(sql`
      SELECT ${ItemMembershipService.allColumns}
      FROM item_membership
      WHERE id = ${id}
    `)
      .then(({ rows }) => rows[0] || null);
  }

  /**
   * Create membership.
   * @param membership Partial membership object with `memberId`, `itemPath`, `permission`, `creator`.
   * @param transactionHandler Database transaction handler
   */
  async create(membership: Partial<ItemMembership>, transactionHandler: TrxHandler) {
    const { memberId, itemPath, permission, creator } = membership;
    return transactionHandler.query<ItemMembership>(sql`
        INSERT INTO item_membership (member_id, item_path, permission, creator)
        VALUES (${memberId}, ${itemPath}, ${permission}, ${creator})
        RETURNING ${ItemMembershipService.allColumns}
      `)
      .then(({ rows }) => rows[0]);
  }

  /**
   * Create multiple memberships given an array of partial membership objects.
   * @param memberships Array of objects with properties: `memberId`, `itemPath`, `permission`, `creator`
   * @param transactionHandler Database transaction handler
   */
  async createMany(memberships: Partial<ItemMembership>[], transactionHandler: TrxHandler) {
    const newRows = memberships.map(
      ({ memberId, itemPath, permission, creator }) => [memberId, itemPath, permission, creator]
    );

    return transactionHandler.query<ItemMembership>(sql`
        INSERT INTO item_membership (member_id, item_path, permission, creator)
          SELECT *
          FROM ${sql.unnest(newRows, ['uuid', 'ltree', 'permissions_enum', 'uuid'])}
        RETURNING ${ItemMembershipService.allColumns}
      `)
      .then(({ rows }) => rows);
  }

  /**
   * Update membership's permission.
   * @param id Membership id
   * @param permission New permission value
   * @param transactionHandler Database transaction handler
   */
  async update(id: string, permission: PermissionLevel, transactionHandler: TrxHandler) {
    return transactionHandler.query<ItemMembership>(sql`
        UPDATE item_membership
        SET permission = ${permission}
        WHERE id = ${id}
        RETURNING ${ItemMembershipService.allColumns}
      `)
      .then(({ rows }) => rows[0]);
  }

  /**
   * Delete membership.
   * @param id Membership id
   * @param transactionHandler Database transaction handler
   */
  async delete(id: string, transactionHandler: TrxHandler) {
    return transactionHandler.query<ItemMembership>(sql`
        DELETE FROM item_membership
        WHERE id = ${id}
        RETURNING ${ItemMembershipService.allColumns}
      `)
      .then(({ rows }) => rows[0] || null);
  }

  /**
   * Delete multiple memberships matching `memberId`+`itemPath`
   * from partial memberships in given array.
   * @param memberships List of objects with: `memberId`, `itemPath`
   * @param transactionHandler Database transaction handler
   */
  async deleteManyMatching(memberships: Partial<ItemMembership>[], transactionHandler: TrxHandler) {
    const conditions =
      memberships.map(({ memberId, itemPath }) => sql`(member_id = ${memberId} AND item_path = ${itemPath})`);

    return transactionHandler.query<ItemMembership>(sql`
        DELETE FROM item_membership
        WHERE ${sql.join(conditions, sql` OR `)}
        RETURNING ${ItemMembershipService.allColumns}
      `)
      .then(({ rows }) => rows);
  }

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
   * @param transactionHandler Database transaction handler
   * @param newParentItem Parent item to where `item` will be moved to
   */
  async moveHousekeeping(item: Item, member: Member, transactionHandler: TrxHandler, newParentItem?: Item) {
    if (!newParentItem) return this.detachedMoveHousekeeping(item, member, transactionHandler);

    const { path: newParentItemPath } = newParentItem;
    const index = item.path.lastIndexOf('.');

    const parentItemPath = index > -1 ? item.path.slice(0, index) : null;
    const itemIdAsPath = index > -1 ? item.path.slice(index + 1) : item.path;
    const { id: creator } = member;

    const { rows } = await transactionHandler.query(sql`
      SELECT
        member_id AS "memberId", item_path AS "itemPath", permission, action,
        first_value(permission) OVER (PARTITION BY member_id ORDER BY action) AS inherited,
        min(nlevel(item_path)) OVER (PARTITION BY member_id) > nlevel(${newParentItemPath}) AS "action2IgnoreInherited"
      FROM (
        -- "last" inherited permission, for each member, at the destination item
        SELECT
          member_id,
          ${newParentItemPath}::ltree AS item_path,
          max(permission) AS permission,
          0 AS action -- 0: inherited at destination (no action)
        FROM item_membership
        WHERE item_path @> ${newParentItemPath}
        GROUP BY member_id

        UNION ALL

        -- permissions to consider "at" the origin of the moving item
        ${this.getPermissionsAtItemSql(item.path, newParentItemPath, itemIdAsPath, parentItemPath)}
      ) AS t2
      ORDER BY member_id, nlevel(item_path), permission;
    `);

    const changes = {
      inserts: [] as Partial<ItemMembership>[],
      deletes: [] as Partial<ItemMembership>[]
    };

    rows.reduce((chngs, row) => {
      const {
        memberId, itemPath,
        permission: p, action, inherited: ip,
        action2IgnoreInherited
      } = row;

      if (action === 0) return chngs;
      if (action === 2 && action2IgnoreInherited) return chngs;

      const permission = p as PermissionLevel;
      const inherited = ip as PermissionLevel;

      // permission (inherited) at the "origin" better than inherited one at "destination"
      if (action === 1 && PermissionLevelCompare.gt(permission, inherited)) {
        chngs.inserts.push({ memberId, itemPath, permission, creator } as Partial<ItemMembership>);
      }

      // permission worse or equal to inherited one at "destination"
      if (action === 2 && PermissionLevelCompare.lte(permission, inherited)) {
        chngs.deletes.push({ memberId, itemPath } as Partial<ItemMembership>);
      }

      return chngs;
    }, changes);

    return changes;
  }

  private getPermissionsAtItemSql(itemPath: string, newParentItemPath: string, itemIdAsPath: string, parentItemPath?: string) {
    const ownItemPermissions = sql`
      SELECT
        member_id,
        ${newParentItemPath} || subpath(item_path, index(item_path, ${itemIdAsPath})) AS item_path,
        permission,
        2 AS action -- 2: belonging to tree (possible DELETE after moving items because of inherited at destination and the "ON UPDATE CASCADE")
      FROM item_membership
      WHERE ${itemPath} @> item_path
    `;

    if (!parentItemPath) return ownItemPermissions;

    return sql`
      SELECT member_id, item_path, max(permission) AS permission, max(action) AS action FROM (
        -- "last" inherited permission, for each member, at the origin of the moving item
        SELECT
          member_id,
          ${newParentItemPath}::ltree || ${itemIdAsPath} AS item_path,
          max(permission) AS permission,
          1 AS action -- 1: inherited at origin (possible INSERT 'at' new item's path)
        FROM item_membership
        WHERE item_path @> ${parentItemPath}
        GROUP BY member_id

        UNION ALL

        -- "own" permissions
        ${ownItemPermissions}
      ) AS t1
      GROUP BY member_id, item_path
    `;
  }

  /**
   * Identify any new memberships that will be necessary to create
   * after moving the item from its parent item to *no-parent*.
   *
   * Moving to *no-parent* is simpler so this method is used instead of `moveHousekeeping()`.
   * @param item Item that will be moved
   * @param member Member used as `creator` for any new memberships
   * @param transactionHandler Database transaction handler
   */
  private async detachedMoveHousekeeping(item: Item, member: Member, transactionHandler: TrxHandler) {
    const index = item.path.lastIndexOf('.');
    const itemIdAsPath = item.path.slice(index + 1);
    const { id: creator } = member;

    const { rows } = await transactionHandler.query(sql`
      SELECT
        member_id AS "memberId",
        max(item_path::text)::ltree AS "itemPath", -- get longest path
        max(permission) AS permission -- get best permission
      FROM item_membership
      WHERE item_path @> ${item.path}
      GROUP BY member_id
    `);

    const changes = {
      inserts: [] as Partial<ItemMembership>[],
      deletes: [] as Partial<ItemMembership>[]
    };

    rows.reduce((chngs, row) => {
      const { memberId, itemPath, permission } = row;

      if (itemPath !== item.path) {
        chngs.inserts.push(
          { memberId, itemPath: itemIdAsPath, permission, creator } as Partial<ItemMembership>
        );
      }

      return chngs;
    }, changes);

    return changes;
  }
}
