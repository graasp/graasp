// global
import { sql, DatabaseTransactionConnectionType as TrxHandler } from 'slonik';
// local
import { Item } from './interfaces/item';

/**
 * Database's first layer of abstraction for Items
 */
export class ItemService {
  // the 'safe' way to dynamically generate the columns names:
  private static allColumns = sql.join(
    [
      'id', 'name', 'description', 'path', 'extra', 'creator',
      ['created_at', 'createdAt'],
      ['updated_at', 'updatedAt'],
    ].map(c =>
      !Array.isArray(c) ?
        sql.identifier([c]) :
        sql.join(c.map(cwa => sql.identifier([cwa])), sql` AS `)
    ),
    sql`, `
  );

  /**
   * Get item matching the given `id` or `null`, if not found.
   * @param id Item id
   * @param transactionHandler Database transaction handler
   */
  async get(id: string, transactionHandler: TrxHandler) {
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
  async getMatchingPath(path: string, transactionHandler: TrxHandler) {
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
  async getMany(ids: string[], transactionHandler: TrxHandler) {
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
  async create(item: Partial<Item>, transactionHandler: TrxHandler) {
    const { id, name, path, creator, description, extra } = item;

    return transactionHandler
      .query<Item>(sql`
        INSERT INTO item (id, name, description, path, extra, creator)
        VALUES (${id}, ${name}, ${description}, ${path}, ${sql.json(extra)}, ${creator})
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
  async update(id: string, data: Partial<Item>, transactionHandler: TrxHandler) {
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
  async delete(id: string, transactionHandler: TrxHandler) {
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
  async getNumberOfChildren(item: Item, transactionHandler: TrxHandler) {
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
  async getChildren(item: Item, transactionHandler: TrxHandler) {
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
  async getNumberOfDescendants(item: Item, transactionHandler: TrxHandler) {
    return transactionHandler
      .oneFirst(sql`
        SELECT count(*) FROM item
        WHERE path <@ ${item.path}
          AND id != ${item.id}
      `) // `AND id != ${item.id}` because <@ includes the item's path
      .then((count: string) => parseInt(count, 10));
  }

  /**
   * Get item's descendants. Ordered by their depth in the tree with given `direction`:
   *
   * * `direction = 'ASC'`: items higher in the tree first
   * * `direction = 'DESC'`: deepest items in the tree first
   * @param item Item whose descendants shoud be considered
   * @param transactionHandler Database transaction handler
   * @param direction Order direction based on item pdepth in the tree
   * @param properties List of Item properties to fetch - defaults to 'all'
   */
  async getDescendants(item: Item, transactionHandler: TrxHandler,
    direction: ('ASC' | 'DESC') = 'ASC', properties?: (keyof Item)[]) {
    let selectColumns;

    if (properties && properties.length) {
      selectColumns = sql.join(
        properties.map(p => sql.identifier([p])),
        sql`, `
      );
    }

    return transactionHandler
      .query<Partial<Item>>(sql`
        SELECT ${selectColumns || ItemService.allColumns} FROM item
        WHERE path <@ ${item.path}
          AND id != ${item.id}
        ORDER BY nlevel(path) ${direction === 'DESC' ? sql`DESC` : sql`ASC`}
      `) // `AND id != ${item.id}` because <@ includes the item's path
      .then(({ rows }) => rows);
  }

  /**
   * Get number of levels to farthest child.
   * @param item Item from where to start
   * @param transactionHandler Database transaction handler
   */
  async getNumberOfLevelsToFarthestChild(item: Item, transactionHandler: TrxHandler) {
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
   * Move item, and its underlying tree, below another item.
   * Or make it a "new" tree if `parentItem` is not provided.
   *
   * (Paths in memberships will be updated automatically -
   * ON UPDATE CASCADE in item_membership's fk from `item_path` to item's `path`)
   * @param item Item to move
   * @param transactionHandler Database transaction handler
   * @param parentItem Destination item
   */
  async move(item: Item, transactionHandler: TrxHandler, parentItem?: Item) {
    const pathSql = parentItem ?
      sql`${parentItem.path} || subpath(path, nlevel(${item.path}) - 1)` :
      sql`subpath(path, nlevel(${item.path}) - 1)`;

    return transactionHandler
      .query(sql`
        UPDATE item
        SET path = ${pathSql}
        WHERE path <@ ${item.path}`
      );
  }
}
