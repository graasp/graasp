// global
import { sql, DatabaseTransactionConnectionType as TrxHandler } from 'slonik';
// other services
import { PermissionLevel } from '../../services/item-memberships/interfaces/item-membership';
// local
import { Item } from './interfaces/item';

declare module 'fastify' {
  interface FastifyInstance {
    itemService: ItemService;
  }
}

/**
 * Database's first layer of abstraction for Items
 */
export class ItemService {
  // the 'safe' way to dynamically generate the columns names:
  private static allColumns = sql.join(
    [
      'id', 'name', 'description', 'type', 'path', 'extra', 'creator',
      ['created_at', 'createdAt'],
      ['updated_at', 'updatedAt'],
    ].map(c =>
      !Array.isArray(c) ?
        sql.identifier([c]) :
        sql.join(c.map(cwa => sql.identifier([cwa])), sql` AS `)
    ),
    sql`, `
  );

  private static allColumnsForJoins = sql.join(
    [
      [['item', 'id'], ['id']],
      [['item', 'name'], ['name']],
      [['item', 'description'], ['description']],
      [['item', 'type'], ['type']],
      [['item', 'path'], ['path']],
      [['item', 'extra'], ['extra']],
      [['item', 'creator'], ['creator']],
      [['item', 'created_at'], ['createdAt']],
      [['item', 'updated_at'], ['updatedAt']],
    ].map(c => sql.join(c.map(cwa => sql.identifier(cwa)), sql` AS `)),
    sql`, `
  );

  /**
   * Get item matching the given `id` or `null`, if not found.
   * @param id Item id
   * @param transactionHandler Database transaction handler
   */
  async get(id: string, transactionHandler: TrxHandler): Promise<Item> {
    return transactionHandler
      .query<Item>(sql`
        SELECT ${ItemService.allColumns}
        FROM item
        WHERE id = ${id}
      `)
      .then(({ rows }) => rows[0] || null);
  }

  /**
   * Get item matching the given `path` or `null`, if not found.
   * @param path Item path
   * @param transactionHandler Database transaction handler
   */
  async getMatchingPath(path: string, transactionHandler: TrxHandler): Promise<Item> {
    return transactionHandler
      .query<Item>(sql`
        SELECT ${ItemService.allColumns}
        FROM item
        WHERE path = ${path}
      `)
      .then(({ rows }) => rows[0] || null);
  }

  /**
   * Get items matching the given `ids` or `[]`, if none is found.
   * @param ids Item ids
   * @param transactionHandler Database transaction handler
   */
  async getMany(ids: string[], transactionHandler: TrxHandler): Promise<readonly Item[]> {
    return transactionHandler
      .query<Item>(sql`
        SELECT ${ItemService.allColumns}
        FROM item
        WHERE id IN (${sql.join(ids, sql`, `)})
      `)
      .then(({ rows }) => rows);
  }

  /**
   * Create given item and return it.
   * @param item Item to create
   * @param transactionHandler Database transaction handler
   */
  async create(item: Partial<Item>, transactionHandler: TrxHandler): Promise<Item> {
    const { id, name, description, type, path, extra, creator } = item;

    return transactionHandler
      .query<Item>(sql`
        INSERT INTO item (id, name, description, type, path, extra, creator)
        VALUES (${id}, ${name}, ${description}, ${type}, ${path}, ${sql.json(extra)}, ${creator})
        RETURNING ${ItemService.allColumns}
      `)
      .then(({ rows }) => rows[0]);
  }

  /**
   * Update item with given changes and return it.
   * @param id Item id
   * @param data Item changes
   * @param transactionHandler Database transaction handler
   */
  async update(id: string, data: Partial<Item>, transactionHandler: TrxHandler): Promise<Item> {
    // dynamically build "column1 = value1, column2 = value2, ..." based on the
    // properties present in data
    const setValues = sql.join(
      Object.keys(data)
        .map((key: keyof Partial<Item>) =>
          sql.join(
            [
              sql.identifier([key]),
              key !== 'extra' ? sql`${data[key]}` : sql.json(data[key])
            ],
            sql` = `
          )
        ),
      sql`, `
    );

    return transactionHandler
      .query<Item>(sql`
        UPDATE item
        SET ${setValues}
        WHERE id = ${id}
        RETURNING ${ItemService.allColumns}
      `)
      .then(({ rows }) => rows[0]);
  }

  /**
   * Delete item matching the given `id`. Return item, or `null`, if delete has no effect.
   *
   * Item memberships targeting this item are "CASCADE DELETEd" in the database.
   * @see database_schema.sql
   * @param id Item id
   * @param transactionHandler Database transaction handler
   */
  async delete(id: string, transactionHandler: TrxHandler): Promise<Item> {
    return transactionHandler
      .query<Item>(sql`
        DELETE FROM item
        WHERE id = ${id}
        RETURNING ${ItemService.allColumns}
      `)
      .then(({ rows }) => rows[0] || null);
  }

  /**
   * Get number of children of given item.
   * @param item Item's children to count
   * @param transactionHandler Database transaction handler
   */
  async getNumberOfChildren(item: Item, transactionHandler: TrxHandler): Promise<number> {
    return transactionHandler
      .oneFirst(sql`
        SELECT count(*) FROM item
        WHERE path ~ ${item.path + '.*{1}'}
      `)
      .then((count: string) => parseInt(count, 10));
  }

  /**
   * Get children of given item.
   * @param item Item's children to fetch
   * @param transactionHandler Database transaction handler
   */
  async getChildren(item: Item, transactionHandler: TrxHandler): Promise<readonly Item[]> {
    return transactionHandler
      .query<Item>(sql`
        SELECT ${ItemService.allColumns} FROM item
        WHERE path ~ ${item.path + '.*{1}'}
      `)
      .then(({ rows }) => rows);
  }

  /**
   * Get number of descendants (at any depth) of given item.
   * @param item Item whose descendants are to count
   * @param transactionHandler Database transaction handler
   */
  async getNumberOfDescendants(item: Item, transactionHandler: TrxHandler): Promise<number> {
    return transactionHandler
      .oneFirst(sql`
        SELECT count(*) FROM item
        WHERE path <@ ${item.path}
          AND id != ${item.id}
      `) // `AND id != ${item.id}` because <@ includes the item's path
      .then((count: string) => parseInt(count, 10));
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
   * @param properties List of Item properties to fetch - returns all if not defined. When defined,
   * the function should be called with `R` as `<Partial<Item>>`: `getDescendants<Partial<Item>>()`
   */
  async getDescendants(item: Item, transactionHandler: TrxHandler,
    direction: ('ASC' | 'DESC') = 'ASC', levels: number | 'ALL' = 'ALL', properties?: (keyof Item)[]): Promise<Partial<Item>[]> {
    let selectColumns;

    if (properties && properties.length) {
      selectColumns = sql.join(
        properties.map(p => sql.identifier([p])),
        sql`, `
      );
    }

    const levelLimit = levels !== 'ALL' && levels > 0 ?
      sql`AND nlevel(path) <= nlevel(${item.path}) + ${levels}` : sql``;

    return transactionHandler
      .query<Partial<Item>>(sql`
        SELECT ${selectColumns || ItemService.allColumns} FROM item
        WHERE path <@ ${item.path}
          AND id != ${item.id}
          ${levelLimit}
        ORDER BY nlevel(path) ${direction === 'DESC' ? sql`DESC` : sql`ASC`}
      `) // `AND id != ${item.id}` because <@ includes the item's path
      // TODO: is there a better way to avoid the error of assigning
      // this result to a mutable property? (.slice(0))
      .then(({ rows }) => rows.slice(0));
  }

  /**
   * Get number of levels to farthest child.
   * @param item Item from where to start
   * @param transactionHandler Database transaction handler
   */
  async getNumberOfLevelsToFarthestChild(item: Item, transactionHandler: TrxHandler): Promise<number> {
    return transactionHandler
      .maybeOneFirst(sql`
        SELECT nlevel(path) - nlevel(${item.path})
        FROM item
        WHERE path <@ ${item.path}
          AND id != ${item.id}
        ORDER BY nlevel(path) DESC
        LIMIT 1
      `) // `AND id != ${item.id}` because <@ includes the item's path
      .then((n: string) => parseInt(n || '0', 10)); // TODO: improve?
  }

  /**
   * Get `member`'s own items (created by member and where member is `admin`)
   * @param memberId Member's id
   * @param transactionHandler Database transaction handler
   * TODO: does this make sense here? Should this be part of different (micro)service??
   */
  async getOwn(memberId: string, transactionHandler: TrxHandler): Promise<Item[]> {
    return transactionHandler
      .query<Item>(sql`
        SELECT ${ItemService.allColumnsForJoins}
        FROM item
        INNER JOIN item_membership
          ON item.path = item_membership.item_path
        WHERE item_membership.member_id = ${memberId}
          AND item_membership.permission = ${PermissionLevel.Admin}
          AND item.creator = ${memberId}
      `)
      // TODO: is there a better way?
      .then(({ rows }) => rows.slice(0));
  }

  /**
   * Get items "shared with" `member` - "highest" items in the membership tree where `member`
   * is not the creator of the item
   * @param memberId Member's id
   * @param transactionHandler Database transaction handler
   * TODO: does this make sense here? Should this be part of different (micro)service??
   */
  async getSharedWith(memberId: string, transactionHandler: TrxHandler): Promise<Item[]> {
    return transactionHandler.query<Item>(sql`
      SELECT ${ItemService.allColumnsForJoins}
      FROM (
        SELECT item_path,
          RANK() OVER (PARTITION BY subpath(item_path, 0, 1) ORDER BY item_path ASC) AS membership_rank
        FROM item_membership
        WHERE member_id = ${memberId}
      ) AS t1
      INNER JOIN item
        ON item.path = t1.item_path
      WHERE t1.membership_rank = 1
        AND item.creator != ${memberId}
      `)
      // TODO: is there a better way?
      .then(({ rows }) => rows.slice(0));
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
    const pathSql = parentItem ?
      sql`${parentItem.path} || subpath(path, nlevel(${item.path}) - 1)` :
      sql`subpath(path, nlevel(${item.path}) - 1)`;

    await transactionHandler
      .query(sql`
        UPDATE item
        SET path = ${pathSql}
        WHERE path <@ ${item.path}`
      );
  }
}
