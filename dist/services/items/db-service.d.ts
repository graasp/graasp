import { DatabaseTransactionConnectionType as TrxHandler } from 'slonik';
import { Item } from './interfaces/item';
/**
 * Database's first layer of abstraction for Items
 */
export declare class ItemService {
    private static allColumns;
    private static allColumnsForJoins;
    /**
     * Get item matching the given `id` or `null`, if not found.
     * @param id Item id
     * @param transactionHandler Database transaction handler
     */
    get(id: string, transactionHandler: TrxHandler): Promise<Item>;
    /**
     * Get item matching the given `path` or `null`, if not found.
     * @param path Item path
     * @param transactionHandler Database transaction handler
     */
    getMatchingPath(path: string, transactionHandler: TrxHandler): Promise<Item>;
    /**
     * Get items matching the given `ids` or `[]`, if none is found.
     * @param ids Item ids
     * @param transactionHandler Database transaction handler
     */
    getMany(ids: string[], transactionHandler: TrxHandler): Promise<readonly Item[]>;
    /**
     * Create given item and return it.
     * @param item Item to create
     * @param transactionHandler Database transaction handler
     */
    create(item: Partial<Item>, transactionHandler: TrxHandler): Promise<Item>;
    /**
     * Update item with given changes and return it.
     * @param id Item id
     * @param data Item changes
     * @param transactionHandler Database transaction handler
     */
    update(id: string, data: Partial<Item>, transactionHandler: TrxHandler): Promise<Item>;
    /**
     * Delete item matching the given `id`. Return item, or `null`, if delete has no effect.
     *
     * Item memberships targeting this item are "CASCADE DELETEd" in the database.
     * @see database_schema.sql
     * @param id Item id
     * @param transactionHandler Database transaction handler
     */
    delete(id: string, transactionHandler: TrxHandler): Promise<Item>;
    /**
     * Get number of children of given item.
     * @param item Item's children to count
     * @param transactionHandler Database transaction handler
     */
    getNumberOfChildren(item: Item, transactionHandler: TrxHandler): Promise<number>;
    /**
     * Get children of given item.
     * @param item Item's children to fetch
     * @param transactionHandler Database transaction handler
     */
    getChildren(item: Item, transactionHandler: TrxHandler): Promise<readonly Item[]>;
    /**
     * Get number of descendants (at any depth) of given item.
     * @param item Item whose descendants are to count
     * @param transactionHandler Database transaction handler
     */
    getNumberOfDescendants(item: Item, transactionHandler: TrxHandler): Promise<number>;
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
    getDescendants(item: Item, transactionHandler: TrxHandler, direction?: ('ASC' | 'DESC'), levels?: number | 'ALL', properties?: (keyof Item)[]): Promise<Partial<Item>[]>;
    /**
     * Get number of levels to farthest child.
     * @param item Item from where to start
     * @param transactionHandler Database transaction handler
     */
    getNumberOfLevelsToFarthestChild(item: Item, transactionHandler: TrxHandler): Promise<number>;
    /**
     * Get `member`'s own items (created by member and where member is `admin`)
     * @param memberId Member's id
     * @param transactionHandler Database transaction handler
     * TODO: does this make sense here? Should this be part of different (micro)service??
     */
    getOwn(memberId: string, transactionHandler: TrxHandler): Promise<Item[]>;
    /**
     * Get items "shared with" `member` - "highest" items in the membership tree where `member`
     * is not the creator of the item
     * @param memberId Member's id
     * @param transactionHandler Database transaction handler
     * TODO: does this make sense here? Should this be part of different (micro)service??
     */
    getSharedWith(memberId: string, transactionHandler: TrxHandler): Promise<Item[]>;
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
    move(item: Item, transactionHandler: TrxHandler, parentItem?: Item): Promise<void>;
}
