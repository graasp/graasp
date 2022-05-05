// global
import { ObjectSchema } from 'fluent-json-schema';
import { sql, DatabaseTransactionConnection as TrxHandler, ValueExpression } from 'slonik';
import { UnknownExtra } from '../../interfaces/extra';
// other services
import { PermissionLevel } from '../../services/item-memberships/interfaces/item-membership';
import { DEFAULT_ITEM_SETTINGS } from '../../util/config';
// local
import { Item } from './interfaces/item';
import { ItemTaskManager } from './interfaces/item-task-manager';

// TODO: this module declaration should be placed somewhere else,
// specially because of 'extendCreateSchema' - that seems very out of place in this file.
declare module 'fastify' {
  interface FastifyInstance {
    items: {
      taskManager: ItemTaskManager;
      dbService: ItemService;
      extendCreateSchema: (itemTypeSchema?: ObjectSchema) => void;
      extendExtrasUpdateSchema: (itemTypeSchema?: ObjectSchema) => void;
    };
  }
}

/**
 * Database's first layer of abstraction for Items
 */
export class ItemService {
  // the 'safe' way to dynamically generate the columns names:
  private static allColumns = sql.join(
    [
      'id',
      'name',
      'description',
      'type',
      'path',
      'extra',
      'settings',
      'creator',
      ['created_at', 'createdAt'],
      ['updated_at', 'updatedAt'],
    ].map((c) =>
      !Array.isArray(c)
        ? sql.identifier([c])
        : sql.join(
            c.map((cwa) => sql.identifier([cwa])),
            sql` AS `,
          ),
    ),
    sql`, `,
  );

  private static allColumnsForJoins = sql.join(
    [
      [['item', 'id'], ['id']],
      [['item', 'name'], ['name']],
      [['item', 'description'], ['description']],
      [['item', 'type'], ['type']],
      [['item', 'path'], ['path']],
      [['item', 'extra'], ['extra']],
      [['item', 'settings'], ['settings']],
      [['item', 'creator'], ['creator']],
      [['item', 'created_at'], ['createdAt']],
      [['item', 'updated_at'], ['updatedAt']],
    ].map((c) =>
      sql.join(
        c.map((cwa) => sql.identifier(cwa)),
        sql` AS `,
      ),
    ),
    sql`, `,
  );

  /**
   * Get item matching the given `id` or `null`, if not found.
   * @param id Item id
   * @param transactionHandler Database transaction handler
   */
  async get<E extends UnknownExtra>(id: string, transactionHandler: TrxHandler): Promise<Item<E>> {
    return transactionHandler
      .query<Item<E>>(
        sql`
        SELECT ${ItemService.allColumns}
        FROM item
        WHERE id = ${id}
      `,
      )
      .then(({ rows }) => rows[0] || null);
  }

  /**
   * Get item matching the given `path` or `null`, if not found.
   * @param path Item path
   * @param transactionHandler Database transaction handler
   */
  async getMatchingPath<E extends UnknownExtra>(
    path: string,
    transactionHandler: TrxHandler,
  ): Promise<Item<E>> {
    return transactionHandler
      .query<Item<E>>(
        sql`
        SELECT ${ItemService.allColumns}
        FROM item
        WHERE path = ${path}
      `,
      )
      .then(({ rows }) => rows[0] || null);
  }

  /**
   * Get items matching the given `ids` or `[]`, if none is found.
   * @param ids Item ids
   * @param transactionHandler Database transaction handler
   */
  async getMany(ids: string[], transactionHandler: TrxHandler): Promise<readonly Item[]> {
    return transactionHandler
      .query<Item>(
        sql`
        SELECT ${ItemService.allColumns}
        FROM item
        WHERE id IN (${sql.join(ids, sql`, `)})
      `,
      )
      .then(({ rows }) => rows);
  }

  /**
   * Create given item and return it.
   * @param item Item to create
   * @param transactionHandler Database transaction handler
   */
  async create<E extends UnknownExtra>(
    item: Partial<Item<E>>,
    transactionHandler: TrxHandler,
  ): Promise<Item<E>> {
    const {
      id,
      name,
      description,
      type,
      path,
      extra,
      creator,
      settings = DEFAULT_ITEM_SETTINGS,
    } = item;

    return transactionHandler
      .query<Item<E>>(
        sql`
        INSERT INTO item (id, name, description, type, path, extra, settings, creator)
        VALUES (${id}, ${name}, ${description}, ${type}, ${path}, ${sql.json(extra)},${sql.json(
          settings,
        )}, ${creator})
        RETURNING ${ItemService.allColumns}
      `,
      )
      .then(({ rows }) => rows[0]);
  }

  /**
   * Update item with given changes and return it.
   * @param id Item id
   * @param data Item changes
   * @param transactionHandler Database transaction handler
   */
  async update<E extends UnknownExtra>(
    id: string,
    data: Partial<Item<E>>,
    transactionHandler: TrxHandler,
  ): Promise<Item<E>> {
    // dynamically build "column1 = value1, column2 = value2, ..." based on the
    // properties present in data
    const setValues = sql.join(
      Object.keys(data).map((key: keyof Item) =>
        sql.join([sql.identifier([key]), this.buildColumnsForUpdate(key, data)], sql` = `),
      ),
      sql`, `,
    );

    return transactionHandler
      .query<Item<E>>(
        sql`
        UPDATE item
        SET ${setValues}
        WHERE id = ${id}
        RETURNING ${ItemService.allColumns}
      `,
      )
      .then(({ rows }) => rows[0]);
  }

  buildColumnsForUpdate<E extends UnknownExtra>(
    key: string,
    data: Partial<Item<E>>,
  ): ValueExpression {
    switch (key) {
      case 'settings':
        return sql`${sql.identifier([key])} || ${sql.jsonb(data[key])}`;
      case 'extra':
        return sql.json(data[key]);
      default:
        return sql`${data[key]}`;
    }
  }

  /**
   * Delete item matching the given `id`. Return item, or `null`, if delete has no effect.
   *
   * Item memberships targeting this item are "CASCADE DELETEd" in the database.
   * @see database_schema.sql
   * @param id Item id
   * @param transactionHandler Database transaction handler
   */
  async delete<E extends UnknownExtra>(
    id: string,
    transactionHandler: TrxHandler,
  ): Promise<Item<E>> {
    return transactionHandler
      .query<Item<E>>(
        sql`
        DELETE FROM item
        WHERE id = ${id}
        RETURNING ${ItemService.allColumns}
      `,
      )
      .then(({ rows }) => rows[0] || null);
  }

  /**
   * Get number of children of given item.
   * @param item Item's children to count
   * @param transactionHandler Database transaction handler
   */
  async getNumberOfChildren(item: Item, transactionHandler: TrxHandler): Promise<number> {
    return transactionHandler
      .oneFirst<string>(
        sql`
        SELECT count(*) FROM item
        WHERE path ~ ${item.path + '.*{1}'}
      `,
      )
      .then((count) => parseInt(count, 10));
  }

  /**
   * Get children of given item.
   * @param item Item's children to fetch
   * @param transactionHandler Database transaction handler
   */
  async getChildren(item: Item, transactionHandler: TrxHandler): Promise<readonly Item[]> {
    return transactionHandler
      .query<Item>(
        sql`
        SELECT ${ItemService.allColumns} FROM item
        WHERE path ~ ${item.path + '.*{1}'}
      `,
      )
      .then(({ rows }) => rows);
  }

  /**
   * Get number of descendants (at any depth) of given item.
   * @param item Item whose descendants are to count
   * @param transactionHandler Database transaction handler
   */
  async getNumberOfDescendants(item: Item, transactionHandler: TrxHandler): Promise<number> {
    return transactionHandler
      .oneFirst<string>(
        sql`
        SELECT count(*) FROM item
        WHERE path <@ ${item.path}
          AND id != ${item.id}
      `,
      ) // `AND id != ${item.id}` because <@ includes the item's path
      .then((count) => parseInt(count, 10));
  }

  /**
   * Get item's descendants, from `levels` below, ordered by their depth/level in the
   * tree, with the given `direction`.
   *
   * @param item Item whose descendants shoud be considered
   * @param transactionHandler Database transaction handler
   * @param direction Order direction based on item depth in the tree
   * * `ASC`: items higher in the tree first
   * * `DESC`: deepest items in the tree first
   * @param levels Levels down the tree to fetch - positive integer or `ALL`; defaults to `ALL`
   * * `1`: children
   * * `2`: children + grandchildren
   * * `3`: children + grandchildren + great-grandchildren
   * @param properties List of Item properties to fetch - returns all if not defined.
   */
  async getDescendants(
    item: Item,
    transactionHandler: TrxHandler,
    direction: 'ASC' | 'DESC' = 'ASC',
    levels: number | 'ALL' = 'ALL',
    properties?: (keyof Item)[],
  ): Promise<Item[]> {
    let selectColumns;

    if (properties && properties.length) {
      selectColumns = sql.join(
        properties.map((p) => sql.identifier([p])),
        sql`, `,
      );
    }

    const levelLimit =
      levels !== 'ALL' && levels > 0
        ? sql`AND nlevel(path) <= nlevel(${item.path}) + ${levels}`
        : sql``;

    return (
      transactionHandler
        .query<Item>(
          sql`
        SELECT ${selectColumns || ItemService.allColumns} FROM item
        WHERE path <@ ${item.path}
          AND id != ${item.id}
          ${levelLimit}
        ORDER BY nlevel(path) ${direction === 'DESC' ? sql`DESC` : sql`ASC`}
      `,
        ) // `AND id != ${item.id}` because <@ includes the item's path
        // TODO: is there a better way to avoid the error of assigning
        // this result to a mutable property? (.slice(0))
        .then(({ rows }) => rows.slice(0))
    );
  }

  /**
   * Get number of levels to farthest child.
   * @param item Item from where to start
   * @param transactionHandler Database transaction handler
   */
  async getNumberOfLevelsToFarthestChild(
    item: Item,
    transactionHandler: TrxHandler,
  ): Promise<number> {
    return transactionHandler
      .maybeOneFirst<string>(
        sql`
        SELECT nlevel(path) - nlevel(${item.path})
        FROM item
        WHERE path <@ ${item.path}
          AND id != ${item.id}
        ORDER BY nlevel(path) DESC
        LIMIT 1
      `,
      ) // `AND id != ${item.id}` because <@ includes the item's path
      .then((n) => parseInt(n || '0', 10)); // TODO: improve?
  }

  /**
   * Get `member`'s own items (created by member and where member is `admin`)
   * @param memberId Member's id
   * @param transactionHandler Database transaction handler
   * TODO: does this make sense here? Should this be part of different (micro)service??
   */
  async getOwn(memberId: string, transactionHandler: TrxHandler): Promise<Item[]> {
    return (
      transactionHandler
        .query<Item>(
          sql`
        SELECT ${ItemService.allColumnsForJoins}
        FROM item
        INNER JOIN item_membership
          ON item.path = item_membership.item_path
        WHERE item_membership.member_id = ${memberId}
          AND item_membership.permission = ${PermissionLevel.Admin}
          AND item.creator = ${memberId}
      `,
        )
        // TODO: is there a better way?
        .then(({ rows }) => rows.slice(0))
    );
  }

  /**
   * Get items "shared with" `member` - "highest" items in the membership tree where `member`
   * is not admin or `member` is admin but not the item creator
   * @param memberId Member's id
   * @param transactionHandler Database transaction handler
   * TODO: does this make sense here? Should this be part of different (micro)service??
   */
  async getSharedWith(memberId: string, transactionHandler: TrxHandler): Promise<Item[]> {
    return (
      transactionHandler
        .query<Item>(
          sql`
      SELECT ${ItemService.allColumnsForJoins}
      FROM (
        SELECT item_path, permission,
          RANK() OVER (PARTITION BY subpath(item_path, 0, 1) ORDER BY item_path ASC) AS membership_rank
        FROM item_membership
        WHERE member_id = ${memberId}
      ) AS t1
      INNER JOIN item
        ON item.path = t1.item_path
      WHERE t1.membership_rank = 1
        AND (
          t1.permission != 'admin'
          OR item.creator != ${memberId}
        )
      `,
        )
        // TODO: is there a better way?
        .then(({ rows }) => rows.slice(0))
    );
  }

  /**
   * Get list of members (ids) that *might* have item with given `itemPath` in their shared items.
   * @param itemPath Item path
   * @param transactionHandler Database transaction handler
   * @returns Array of memberIds (empty or w/ memberIds/strings)
   */
  async membersWithSharedItem(
    itemPath: string,
    transactionHandler: TrxHandler,
  ): Promise<readonly string[]> {
    const pathLevels = itemPath.split('.').length;

    return transactionHandler.anyFirst<string>(sql`
        SELECT member_id AS memberId
        FROM (
          SELECT member_id,
            count(*) AS num_memberships_till_item_path,
            max(nlevel(item_path)) AS levels
          FROM item_membership
          WHERE item_path @> ${itemPath}
          GROUP BY member_id
        ) AS t1
        WHERE levels = ${pathLevels} AND num_memberships_till_item_path = 1
      `);
  }

  /**
   * Move item, and its underlying tree, below another item.
   * Or make it a "new" tree if `parentItem` is not provided.
   *
   * (Paths in memberships will be updated automatically -
   * ON UPDATE CASCADE in item_membership's fk from `item_path` to item's `path`)
   * @param item Item to move
   * @param transactionHandler Database transaction handler
   * @param parentItem Destination item
   */
  async move(item: Item, transactionHandler: TrxHandler, parentItem?: Item): Promise<void> {
    const pathSql = parentItem
      ? sql`${parentItem.path} || subpath(path, nlevel(${item.path}) - 1)`
      : sql`subpath(path, nlevel(${item.path}) - 1)`;

    await transactionHandler.query(sql`
        UPDATE item
        SET path = ${pathSql}
        WHERE path <@ ${item.path}`);
  }
}
