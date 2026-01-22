import { count, countDistinct, getViewSelectedFields } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  SQL,
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';
import { v4 } from 'uuid';

import {
  DEFAULT_LANG,
  type ItemSettings,
  ItemType,
  MAX_ITEM_NAME_LENGTH,
  MAX_TREE_LEVELS,
  type Paginated,
  type Pagination,
  buildPathFromIds,
  getChildFromPath,
  getParentFromPath,
} from '@graasp/sdk';

import type { DBConnection } from '../../drizzle/db';
import {
  isAncestorOrSelf,
  isDescendantOrSelf,
  isDirectChild,
  itemFullTextSearch,
  keywordSearch,
  transformLangToReconfigLang,
} from '../../drizzle/operations';
import {
  accountsTable,
  itemMembershipsTable,
  itemVisibilitiesTable,
  items,
  itemsRawTable,
  membersView,
  publishedItemsTable,
} from '../../drizzle/schema';
import type {
  ItemRaw,
  ItemTypeUnion,
  ItemWithCreator,
  MemberRaw,
  MinimalItemForInsert,
} from '../../drizzle/types';
import { IllegalArgumentException } from '../../repositories/errors';
import type { AuthenticatedUser, MaybeUser, MinimalMember } from '../../types';
import { getSearchLang } from '../../utils/config';
import {
  HierarchyTooDeep,
  InvalidMoveTarget,
  ItemNotFolder,
  ItemNotFound,
  NothingToUpdateItem,
  TooManyDescendants,
  UnexpectedError,
} from '../../utils/errors';
import { isMember } from '../authentication';
import {
  FILE_METADATA_DEFAULT_PAGE_SIZE,
  FILE_METADATA_MAX_PAGE_SIZE,
  FILE_METADATA_MIN_PAGE,
} from '../member/constants';
import { DEFAULT_ORDER, IS_COPY_REGEX, ITEMS_PAGE_SIZE_MAX } from './constants';
import { type FolderItem, isItemType } from './discrimination';
import { ItemOrderingError } from './errors';
import {
  type ItemChildrenParams,
  type ItemSearchParams,
  Ordering,
  SortBy,
  orderingToUpperCase,
} from './types';
import { sortChildrenForTreeWith } from './utils';

const DEFAULT_COPY_SUFFIX = ' (2)';
const RESCALE_ORDER_THRESHOLD = 0.1;

const DEFAULT_THUMBNAIL_SETTING: ItemSettings = {
  hasThumbnail: false,
};

type CreateItemBody = {
  item: Partial<ItemRaw> & Pick<ItemRaw, 'name' | 'type'>;
  creator: MinimalMember;
  parentItem?: FolderItem;
};

@singleton()
export class ItemRepository {
  constructor() {}

  checkHierarchyDepth(item: ItemRaw, additionalNbLevel = 1): void {
    // check if hierarchy it too deep
    // adds nb of items to be created
    const itemDepth = item.path.split('.').length;
    if (itemDepth + additionalNbLevel > MAX_TREE_LEVELS) {
      throw new HierarchyTooDeep();
    }
  }

  async checkNumberOfDescendants(
    dbConnection: DBConnection,
    item: ItemRaw,
    maximum: number,
  ): Promise<void> {
    // check how "big the tree is" below the item

    const [{ count: numberOfDescendants }] = await dbConnection
      .select({ count: count() })
      .from(items)
      .where(isDescendantOrSelf(items.path, item.path));

    if (numberOfDescendants > maximum) {
      throw new TooManyDescendants(numberOfDescendants);
    }
  }

  /**
   * build item based on propeties
   * does not save it
   */
  createOne(args: {
    name: ItemRaw['name'];
    description?: ItemRaw['description'];
    type?: ItemRaw['type'];
    extra?: ItemRaw['extra'];
    settings?: ItemRaw['settings'];
    creator: MinimalMember;
    lang?: ItemRaw['lang'];
    parent?: {
      type: ItemRaw['type'];
      id: ItemRaw['id'];
      path: ItemRaw['path'];
      lang?: ItemRaw['lang'];
    };
    order?: ItemRaw['order'];
  }) {
    const {
      name,
      description = null,
      parent,
      type = ItemType.FOLDER,
      extra,
      settings = {},
      lang,
      creator,
      order,
    } = args;

    if (parent && parent.type !== ItemType.FOLDER) {
      throw new ItemNotFolder({ id: parent.id });
    }

    let parsedExtra = extra ? JSON.parse(JSON.stringify(extra)) : {};
    const id = v4();

    // if item is a folder and the extra is empty
    if (type === ItemType.FOLDER && !(ItemType.FOLDER in parsedExtra)) {
      parsedExtra = { folder: {} };
    }

    const item = {
      id,
      path: parent ? `${parent.path}.${buildPathFromIds(id)}` : buildPathFromIds(id),
      name,
      description,
      type,
      extra: parsedExtra,
      settings: {
        ...DEFAULT_THUMBNAIL_SETTING,
        ...settings,
      },
      // set lang from user lang
      lang: lang ?? parent?.lang ?? creator?.lang ?? DEFAULT_LANG,
      creatorId: creator.id,
      order,
    };

    return item;
  }

  async getOne(dbConnection: DBConnection, id: string): Promise<ItemWithCreator | null> {
    const results = await dbConnection
      .select()
      .from(items)
      .leftJoin(accountsTable, eq(items.creatorId, accountsTable.id))
      .where(eq(items.id, id))
      .limit(1);

    if (results.length !== 1) {
      return null;
    }

    const { account, item_view } = results[0];
    return {
      ...item_view,
      creator: account as MemberRaw,
    };
  }

  async getOneOrThrow(dbConnection: DBConnection, id: string): Promise<ItemRaw> {
    const result = await dbConnection.select().from(items).where(eq(items.id, id)).limit(1);

    if (!result.length) {
      throw new ItemNotFound(id);
    }

    return result[0];
  }

  async getOneWithCreatorOrThrow(dbConnection: DBConnection, id: string): Promise<ItemWithCreator> {
    const result = await dbConnection
      .select()
      .from(items)
      .leftJoin(accountsTable, eq(items.creatorId, accountsTable.id))
      .where(eq(items.id, id))
      .limit(1);

    if (!result.length) {
      throw new ItemNotFound(id);
    }
    return {
      ...result[0].item_view,
      creator: result[0].account as MemberRaw,
    };
  }

  async getDeletedById(dbConnection: DBConnection, id: string): Promise<ItemRaw> {
    const item = await dbConnection
      .select()
      .from(itemsRawTable)
      .where(and(eq(itemsRawTable.id, id), isNotNull(itemsRawTable.deletedAt)))
      .limit(1);

    if (!item.length) {
      throw new ItemNotFound(id);
    }

    return item[0];
  }

  /**
   * options.includeCreator {boolean} if true, return full creator
   * options.types {boolean} if defined, filter out the items
   * */
  async getAncestors(dbConnection: DBConnection, item: ItemRaw): Promise<ItemWithCreator[]> {
    if (!item.path.includes('.')) {
      return [];
    }

    const result = await dbConnection
      .select()
      .from(items)
      .leftJoin(accountsTable, eq(items.creatorId, accountsTable.id))
      .where(and(isAncestorOrSelf(items.path, item.path), ne(items.id, item.id)))
      .orderBy(asc(items.path));

    return result.map(({ account, item_view }) => ({
      ...item_view,
      creator: account as MemberRaw,
    }));
  }

  /**
   * Return public parents of item
   * Do not consider hidden setting, because a parent that is hidden will hide its child, so in that case the child won't be accessible anyway
   */
  async getParentsForPublic(dbConnection: DBConnection, item: ItemRaw) {
    const itemTree = await dbConnection
      .select()
      .from(items)
      .where(and(isAncestorOrSelf(items.path, item.path), ne(items.id, item.id)))
      .as('item_tree');

    const publicTree = dbConnection
      .select()
      .from(itemVisibilitiesTable)
      .where(
        and(
          isAncestorOrSelf(itemVisibilitiesTable.itemPath, item.path),
          ne(itemVisibilitiesTable.itemPath, item.path),
          eq(itemVisibilitiesTable.type, 'public'),
        ),
      )
      .as('is_public');

    // duplicate can happen if there are multiple public visibilities in the tree
    const parents = dbConnection
      .selectDistinctOn([itemTree.id], {
        id: itemTree.id,
        name: itemTree.name,
        path: itemTree.path,
      })
      .from(itemTree)
      .leftJoin(publicTree, isAncestorOrSelf(publicTree.itemPath, itemTree.path))
      .where(isNotNull(publicTree.type))
      .as('parents');

    return await dbConnection
      .select()
      .from(parents)
      .orderBy(asc(sql`nlevel(path)`));
  }

  /**
   * Return parents of item that the user has access to
   * Do not consider hidden setting, because a parent that is hidden will hide its child, so in that case the child won't be accessible anyway
   */
  async getParentsForAccount(dbConnection: DBConnection, item: ItemRaw, user: AuthenticatedUser) {
    const itemTree = await dbConnection
      .select({ id: items.id, name: items.name, path: items.path })
      .from(items)
      .where(and(isAncestorOrSelf(items.path, item.path), ne(items.id, item.id)))
      .as('item_tree');

    const imTree = dbConnection
      .select()
      .from(itemMembershipsTable)
      .where(
        and(
          isAncestorOrSelf(itemMembershipsTable.itemPath, item.path),
          eq(itemMembershipsTable.accountId, user.id),
          ne(itemMembershipsTable.itemPath, item.path),
        ),
      )
      .as('im_tree');

    const publicTree = dbConnection
      .select()
      .from(itemVisibilitiesTable)
      .where(
        and(
          isAncestorOrSelf(itemVisibilitiesTable.itemPath, item.path),
          ne(itemVisibilitiesTable.itemPath, item.path),
          eq(itemVisibilitiesTable.type, 'public'),
        ),
      )
      .as('is_public');

    const conditions = or(
      eq(imTree.permission, 'admin'),
      eq(imTree.permission, 'write'),
      eq(imTree.permission, 'read'),
      isNotNull(publicTree.type),
    );

    // duplicate can happen if there are multiple public visibilities or memberships in the tree
    const parents = dbConnection
      .selectDistinctOn([itemTree.id], {
        id: itemTree.id,
        name: itemTree.name,
        path: itemTree.path,
      })
      .from(itemTree)
      .leftJoin(imTree, isAncestorOrSelf(imTree.itemPath, itemTree.path))
      .leftJoin(publicTree, isAncestorOrSelf(publicTree.itemPath, itemTree.path))
      .where(conditions)
      .as('parents');

    return await dbConnection
      .select()
      .from(parents)
      .orderBy(asc(sql`nlevel(path)`));
  }

  /**
   * return children of given parent, non-ordered
   * @param db
   * @param parent
   * @returns
   */
  async getNonOrderedChildren(dbConnection: DBConnection, parent: FolderItem): Promise<ItemRaw[]> {
    if (parent.type !== ItemType.FOLDER) {
      throw new ItemNotFolder({ id: parent.id });
    }

    return await dbConnection.select().from(items).where(isDirectChild(items.path, parent.path));
  }

  /**
   * return children of given parent, ordered by order
   * @param db
   * @param parent
   * @returns
   */
  async getChildren(dbConnection: DBConnection, parent: ItemRaw): Promise<ItemRaw[]> {
    if (parent.type !== ItemType.FOLDER) {
      throw new ItemNotFolder({ id: parent.id });
    }

    return await dbConnection
      .select()
      .from(items)
      .where(isDirectChild(items.path, parent.path))
      // use `order` column for sorting
      // use `createdAt` column as a backup in case two items have the same `order` value
      .orderBy(() => [asc(items.order), asc(items.createdAt)]);
  }

  /**
   * return children of given parent, ordered by order, with creator
   * @param db
   * @param actor
   * @param parent
   * @param params
   * @returns
   */
  async getFilteredChildren(
    dbConnection: DBConnection,
    actor: MaybeUser,
    parent: ItemRaw,
    params?: ItemChildrenParams,
  ): Promise<ItemWithCreator[]> {
    if (parent.type !== ItemType.FOLDER) {
      throw new ItemNotFolder({ id: parent.id });
    }

    // reunite where conditions
    // is direct child
    const andConditions: (SQL | undefined)[] = [isDirectChild(items.path, parent.path)];

    if (params?.types) {
      const types = params.types;
      andConditions.push(inArray(items.type, types));
    }

    // keyword search
    const allKeywords = params?.keywords?.filter((s) => s && s.length);
    if (allKeywords && allKeywords.length) {
      const keywordsString = allKeywords.join(' ');

      // gather distinct involved languages, from actor and item
      const memberLang = actor && isMember(actor) && actor.lang ? actor.lang : DEFAULT_LANG;
      const langs = ['simple', transformLangToReconfigLang(items.lang), getSearchLang(memberLang)];

      andConditions.push(
        or(
          // search with involved languages
          ...langs.map((l) => itemFullTextSearch(items, l, keywordsString)),
          // raw words search
          ...keywordSearch(items.name, allKeywords),
        ),
      );
    }

    const result = await dbConnection
      .select()
      .from(items)
      .leftJoin(membersView, eq(items.creatorId, membersView.id))
      .where(and(...andConditions))
      // use order for ordering
      // backup order by in case two items has same ordering
      .orderBy(() => [asc(items.order), asc(items.createdAt)]);

    return result.map(({ item_view, members_view }) => ({
      ...item_view,
      creator: members_view as MemberRaw,
    }));
  }

  async getChildrenNames(
    dbConnection: DBConnection,
    parent: FolderItem,
    { startWith }: { startWith?: string },
  ): Promise<string[]> {
    const whereConditions = [isDirectChild(items.path, parent.path)];

    if (startWith) {
      whereConditions.push(ilike(items.name, `${startWith}%`));
    }

    const itemNames = await dbConnection
      .select({ name: items.name })
      .from(items)
      .where(and(...whereConditions));
    return itemNames.map(({ name }) => name);
  }

  /**
   * Return tree below item
   * @param {Item} item item to get descendant tree from
   * @param {boolean} [options.ordered=false] whether the descendants should be ordered by path, guarantees to iterate on parent before children
   * @param {string[]} [options.types] filter out the items by type. If undefined or empty, all types are returned.
   * @returns {Item[]}
   */
  async getDescendants(
    dbConnection: DBConnection,
    item: FolderItem,
    options?: { types?: ItemTypeUnion[] },
  ): Promise<ItemWithCreator[]> {
    const { types } = options ?? {};

    const whereConditions = [isDescendantOrSelf(items.path, item.path), ne(items.id, item.id)];
    if (types && types.length > 0) {
      whereConditions.push(inArray(items.type, types));
    }

    const result = await dbConnection
      .select()
      .from(items)
      .leftJoin(membersView, eq(items.creatorId, membersView.id))
      .where(and(...whereConditions))
      .orderBy(asc(items.path));

    const descendants = result.map(({ members_view, item_view }) => ({
      ...item_view,
      creator: members_view as MemberRaw,
    }));

    return sortChildrenForTreeWith<ItemWithCreator>(descendants, item);
  }

  /**
   * Returns items matching provided ids, ordered by the given ids array.
   * @param dbConnection current connection to the db
   * @param ids items to retrieve, in order
   * @returns ordered items with given ids
   */
  async getMany(dbConnection: DBConnection, ids: string[]): Promise<ItemWithCreator[]> {
    if (!ids.length) {
      return [];
    }

    const result = (
      await dbConnection
        .select()
        .from(items)
        .leftJoin(accountsTable, eq(items.creatorId, accountsTable.id))
        .where(inArray(items.id, ids))
    ).map(({ account, item_view }) => ({
      ...item_view,
      creator: account as MemberRaw,
    }));

    if (result.length != ids.length) {
      const resultIds = result.map(({ id }) => id);
      const missingId = ids.find((id) => !resultIds.includes(id));
      throw new ItemNotFound(missingId);
    }

    // order here by id
    result.sort((a, b) => {
      const aIdx = ids.findIndex((i) => i === a.id);
      const bIdx = ids.findIndex((i) => i === b.id);
      return aIdx > bIdx ? 1 : -1;
    });

    return result;
  }

  async getNumberOfLevelsToFarthestChild(
    dbConnection: DBConnection,
    item: ItemRaw,
  ): Promise<number> {
    const farthestItem = await dbConnection
      .select({ path: items.path })
      .from(items)
      .where(and(isDescendantOrSelf(items.path, item.path), ne(items.id, item.id)))
      .orderBy(desc(sql`nlevel(path)`))
      .limit(1);
    return farthestItem?.[0]?.path?.split('.')?.length ?? 0;
  }

  async getOwn(dbConnection: DBConnection, memberId: string): Promise<ItemRaw[]> {
    const result = await dbConnection
      .select()
      .from(items)
      .leftJoin(accountsTable, eq(items.creatorId, accountsTable.id))
      .innerJoin(
        itemMembershipsTable,
        isDescendantOrSelf(itemMembershipsTable.itemPath, items.path),
      )
      .where(
        and(
          eq(items.creatorId, memberId),
          eq(itemMembershipsTable.permission, 'admin'),
          eq(sql`nlevel(${items.path})`, 1),
        ),
      )
      .orderBy(desc(items.updatedAt));

    return result.map(({ account, item_view }) => ({
      ...item_view,
      creator: account,
    }));
  }

  async move(dbConnection: DBConnection, item: ItemRaw, parentItem?: FolderItem): Promise<ItemRaw> {
    if (parentItem) {
      // attaching tree to new parent item
      const { id: parentItemId, path: parentItemPath } = parentItem;

      // cannot move inside non folder item
      if (parentItem.type !== ItemType.FOLDER) {
        throw new ItemNotFolder({ id: parentItemId });
      }

      // fail if
      if (
        parentItemPath.startsWith(item.path) || // moving into itself or "below" itself
        getParentFromPath(item.path) === parentItemId // moving to the same parent ("not moving")
      ) {
        throw new InvalidMoveTarget(parentItemId);
      }

      // TODO: should this info go into 'message'? (it's the only exception to the rule)
    } else if (!getParentFromPath(item.path)) {
      // moving from "no-parent" to "no-parent" ("not moving")
      throw new InvalidMoveTarget();
    }

    // move item (and subtree) - update paths of all items
    //  Move item, and its underlying tree, below another item.
    //  Or make it a "new" tree if `parentItem` is not provided.

    //   (Paths in memberships will be updated automatically -
    //    ON UPDATE CASCADE in item_membership's fk from `item_path` to item's `path`)
    const pathSql = parentItem
      ? sql`${parentItem.path} || subpath(${itemsRawTable.path}, nlevel(${item.path}) - 1)`
      : sql`subpath(${itemsRawTable.path}, nlevel(${item.path}) - 1)`;

    // get new order value
    const order = await this.getNextOrderCount(dbConnection, parentItem?.path);

    const res = await dbConnection
      .update(itemsRawTable)
      .set({ path: pathSql, order })
      .where(isDescendantOrSelf(itemsRawTable.path, item.path))
      .returning();
    return res[0];
  }

  async updateOne(
    dbConnection: DBConnection,
    id: string,
    data: Partial<ItemRaw>,
  ): Promise<ItemRaw> {
    // update only if data is not empty
    if (!Object.keys(data).length) {
      throw new IllegalArgumentException("The item's body cannot be empty!");
    }

    const item = await this.getOneOrThrow(dbConnection, id);

    // only allow for item type specific changes in extra
    const newData = data;

    const extraForType = data.extra?.[item.type];
    if (newData.extra && extraForType) {
      newData.extra = {
        [item.type]: Object.assign({}, item.extra[item.type], extraForType),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    }

    if (newData.settings) {
      newData.settings = Object.assign({}, item.settings, data.settings);
      if (Object.keys(newData.settings).length === 0) {
        delete newData.settings;
      }
    }

    // has at least one defined value to update
    if (Object.values(newData).filter(Boolean).length === 0) {
      throw new NothingToUpdateItem();
    }
    const res = await dbConnection
      .update(itemsRawTable)
      .set(newData)
      .where(eq(itemsRawTable.id, id))
      .returning();
    return res[0];
  }

  public async addOne(dbConnection: DBConnection, { item, creator, parentItem }: CreateItemBody) {
    const newItem = this.createOne({
      ...item,
      creator,
      parent: parentItem,
    });

    const result = await dbConnection.insert(itemsRawTable).values(newItem).returning();

    return result[0];
  }

  public async addMany(
    dbConnection: DBConnection,
    items: (Partial<ItemRaw> & Pick<ItemRaw, 'name' | 'type'>)[],
    creator: MinimalMember,
    parent?: FolderItem,
  ): Promise<ItemRaw[]> {
    const newItems = items.map((item) =>
      this.createOne({
        ...item,
        creator,
        parent,
      }),
    );

    const result = await dbConnection.insert(itemsRawTable).values(newItems).returning();

    return result;
  }

  /////// -------- COPY
  async copy(
    dbConnection: DBConnection,
    item: ItemRaw,
    creator: MinimalMember,
    siblingsName: string[],
    parentItem?: FolderItem,
  ): Promise<{
    copyRoot: ItemRaw;
    treeCopyMap: Map<string, { original: ItemRaw; copy: MinimalItemForInsert }>;
  }> {
    // cannot copy inside non folder item
    if (parentItem && parentItem.type !== ItemType.FOLDER) {
      throw new ItemNotFolder({ id: parentItem.id });
    }

    // copy (memberships from origin are not copied/kept)
    const treeItemsCopy = await this._copy(dbConnection, item, creator, siblingsName, parentItem);

    // return copy item + all descendants
    const newItems = [...treeItemsCopy.values()].map(({ copy }) => copy);
    const createdItems = await dbConnection.insert(itemsRawTable).values(newItems).returning();

    const newItemRef = createdItems[0];
    if (!newItemRef) {
      throw new UnexpectedError({ operation: 'copy', itemId: item.id });
    }

    return {
      copyRoot: await this.getOneOrThrow(dbConnection, newItemRef.id),
      treeCopyMap: treeItemsCopy,
    };
  }

  /**
   * Copy whole tree with new paths and same member as creator
   * @param original original item to be copied
   * @param creator Member who will be the creator of the copied items
   * @param siblings Siblings that the copied item will have
   * @param parentItem Parent item whose path will 'prefix' all paths
   */
  private async _copy(
    dbConnection: DBConnection,
    original: ItemRaw,
    creator: MinimalMember,
    siblingsName: string[],
    parentItem?: FolderItem,
  ) {
    const old2New = new Map<string, { copy: MinimalItemForInsert; original: ItemRaw }>();

    // get next order value
    const order = await this.getNextOrderCount(dbConnection, parentItem?.path);
    // copy target parent
    const copiedItem = this.createOne({
      ...original,
      creator,
      parent: parentItem,
      name: this.addCopySuffix(original.name, siblingsName),
      order,
    });
    old2New.set(original.id, { copy: copiedItem, original: original });

    // handle descendants - change path
    if (isItemType(original, ItemType.FOLDER)) {
      await this.copyDescendants(dbConnection, original, creator, old2New);
    }

    return old2New;
  }

  /**
   * add in map generated copies for descendants of item, in given map
   * @param original
   * @param old2New mapping from original item to copied data, in-place updates
   */
  private async copyDescendants(
    dbConnection: DBConnection,
    original: FolderItem,
    creator: MinimalMember,
    old2New: Map<string, { copy: MinimalItemForInsert; original: ItemRaw }>,
  ): Promise<void> {
    const descendants = sortChildrenForTreeWith(
      await this.getDescendants(dbConnection, original),
      original,
    );
    for (const element of descendants) {
      const original = element;
      const { id, path } = original;

      // process to get copy of direct parent
      const pathSplit = path.split('.');
      const oldPath = pathSplit.pop();
      // this shouldn't happen
      if (!oldPath) {
        throw new Error('Path is not defined');
      }
      const oldParentPath = pathSplit.pop();
      // this shouldn't happen
      if (!oldParentPath) {
        throw new Error('Path is not defined');
      }
      const oldParentId_ = getChildFromPath(oldParentPath);
      const oldParentObject = old2New.get(oldParentId_);
      // this shouldn't happen
      if (!oldParentObject) {
        throw new Error('Old parent is not defined');
      }

      const copiedItem = this.createOne({
        ...original,
        creator,
        parent: oldParentObject.copy,
      });

      old2New.set(id, { copy: copiedItem, original });
    }
  }

  /**
   * Return a copy with a suffix of the string given in parameter. The suffix is determined by the siblings of the item.
   * If there is no sibling with the same name, the copied name will be the same as the original name.
   * The suffix respects the format " (0)". "0" is a succinct positive number starting at 2.
   * If the string given in parameter already has a valid suffix, increment the number.
   * If the copied name exceeds the maximum characters allowed, the original name will be shorten from the end,
   * the copied name will have the maximum allowed length.
   * @param name string to copy.
   * @param siblings list of siblings to be used to check if the copied name already exist.
   * @returns a copy of the string given in parameter, with a suffix.
   */
  private addCopySuffix(name: string, siblingsName: string[]): string {
    const maxIterations = siblingsName.length;
    let result = name;
    for (let i = 0; i < maxIterations; i++) {
      const twinIndex = siblingsName.findIndex((name) => name === result);
      if (twinIndex >= 0) {
        result = this.incrementCopySuffix(result);
        // By definition, the result string will never be the same as the current twin, so we can remove it from the list.
        siblingsName.splice(twinIndex, 1);
      } else {
        return result;
      }
    }
    return result;
  }

  /**
   * Return a copy with a suffix of the string given in parameter.
   * The suffix respect the format " (0)". "0" is a succint positive number starting at 2.
   * If the string given in parameter already have a valid suffix, increase the number by 1.
   * If the copied name exceed the maximum characters allowed, the original name will be shorten,
   * the copied name will be equals to the maximum allowed.
   * @param name string to copy.
   * @returns a copy of the string given in parameter, with a suffix.
   */
  private incrementCopySuffix(name: string): string {
    // If the name already have a copy suffix
    let result = name;
    if (IS_COPY_REGEX.test(name)) {
      // Then fetch the number, and increase it.
      const suffixStart = name.lastIndexOf('(') + 1;
      const number = Number(name.substring(suffixStart, name.length - 1)) + 1;
      result = `${name.substring(0, suffixStart)}${number})`;
    } else {
      result += DEFAULT_COPY_SUFFIX;
    }
    // If the copied name exceed the maximum item name length.
    if (result.length > MAX_ITEM_NAME_LENGTH) {
      // Then shorten the original name to match the maximum length.
      const suffixStart = result.lastIndexOf('(');
      const suffixLength = result.length - suffixStart + 1;
      result =
        result.substring(0, MAX_ITEM_NAME_LENGTH - suffixLength) +
        result.substring(suffixStart - 1, result.length);
    }
    return result;
  }

  /**
   * @param memberId member to get the storage for
   * @param itemType file item type
   * @returns total storage used by file items
   */
  async getItemSumSize(dbConnection: DBConnection, memberId: string): Promise<number> {
    const result = await dbConnection
      .select({
        total: sql<string>`SUM(((${items.extra}->${ItemType.FILE})->'size')::bigint)`,
      })
      .from(items)
      .where(and(eq(items.creatorId, memberId), eq(items.type, ItemType.FILE)));
    const [{ total }] = result;
    return parseInt(total ?? 0);
  }

  async getFilesMetadata(
    dbConnection: DBConnection,
    memberId: string,
    { page = FILE_METADATA_MIN_PAGE, pageSize = FILE_METADATA_DEFAULT_PAGE_SIZE }: Pagination,
  ) {
    const limit = Math.min(pageSize, FILE_METADATA_MAX_PAGE_SIZE);
    const skip = (page - 1) * limit;

    // bug: it is important to select manually the fields we need, as alias on a view does not automatically generate the correct return values (wrong alias name)
    const parentTable = alias(items, 'parent');
    const result = await dbConnection
      .select({
        id: items.id,
        name: items.name,
        updatedAt: items.updatedAt,
        extra: items.extra,
        parentId: sql<string>`parent.id`,
        parentName: sql<string>`parent.name`,
      })
      .from(items)
      .leftJoin(
        parentTable,
        sql`${parentTable.path} = subpath(${items.path}, 0, (nlevel(${items.path}) - 1))`,
      )
      .where(and(eq(items.creatorId, memberId), eq(items.type, ItemType.FILE)))
      .offset(skip)
      // order by size
      .orderBy(desc(sql`(${items.extra}::json -> ${ItemType.FILE} ->> 'size')::decimal`))
      .limit(limit);

    const entities = result.map(({ parentName, parentId, extra, ...item }) => ({
      ...item,
      size: extra[ItemType.FILE].size,
      path: extra[ItemType.FILE].path,
      parent: parentId
        ? {
            id: parentId,
            name: parentName,
          }
        : undefined,
    }));

    return entities;
  }

  /**
   * Return published items for given member
   * @param memberId
   * @returns published items for given member
   */
  async getPublishedItemsForMember(
    dbConnection: DBConnection,
    memberId: MinimalMember['id'],
  ): Promise<ItemWithCreator[]> {
    const result = await dbConnection
      .select()
      .from(items)
      .innerJoin(publishedItemsTable, eq(publishedItemsTable.itemPath, items.path))
      .innerJoin(
        itemMembershipsTable,
        and(
          isAncestorOrSelf(itemMembershipsTable.itemPath, items.path),
          inArray(itemMembershipsTable.permission, ['admin', 'write']),
        ),
      )
      .innerJoin(
        accountsTable,
        and(eq(accountsTable.id, memberId), eq(items.creatorId, accountsTable.id)),
      );

    return result.map(({ item_view, account }) => ({
      ...item_view,
      creator: account as MemberRaw,
    }));
  }

  async delete(dbConnection: DBConnection, args: ItemRaw['id'][]): Promise<void> {
    await dbConnection.delete(itemsRawTable).where(inArray(itemsRawTable.id, args));
  }
  async softRemove(dbConnection: DBConnection, args: ItemRaw[]): Promise<ItemRaw[]> {
    return await dbConnection
      .update(itemsRawTable)
      .set({ deletedAt: new Date().toISOString() })
      .where(
        inArray(
          itemsRawTable.id,
          args.map(({ id }) => id),
        ),
      )
      .returning();
  }
  async recover(dbConnection: DBConnection, args: ItemRaw[]): Promise<ItemRaw[]> {
    return await dbConnection
      .update(itemsRawTable)
      .set({ deletedAt: null })
      .where(
        inArray(
          itemsRawTable.id,
          args.map(({ id }) => id),
        ),
      )
      .returning();
  }

  /**
   * Return the next valid order value to use for inserting a new item.
   * This value is bigger than the position of given `itemId` but smaller than the next row.
   * Throw if used outside of a parent/folder.
   * @param parentPath scope of the order
   * @param previousItemId id of the item whose order will be smaller than the returned order
   * @returns {number|null} next valid order value
   */
  async getNextOrderCount(
    dbConnection: DBConnection,
    parentPath?: ItemRaw['path'],
    previousItemId?: ItemRaw['id'],
  ): Promise<number | null> {
    // no order for root
    if (!parentPath) {
      return null;
    }

    // by default take the biggest value
    let orderDirection = desc;
    const whereConditions = [isDirectChild(items.path, parentPath)];

    if (previousItemId) {
      // might not exist
      const previousItems = await dbConnection
        .select({ id: items.id, order: items.order })
        .from(items)
        .where(and(eq(items.id, previousItemId), isDirectChild(items.path, parentPath)))
        .limit(1);

      // if needs to add in between, remove previous elements and order by next value to get the first one
      if (previousItems.length) {
        const previousItemOrder = previousItems[0].order;
        if (previousItemOrder) {
          // will take smallest value corresponding to given previous item id
          orderDirection = asc;
          whereConditions.push(gte(items.order, previousItemOrder));
        }
      }
    }
    const result = await dbConnection
      .select({
        next: sql<number>`(${items.order} + (lead(${items.order}, 1, ${items.order} + ( ${DEFAULT_ORDER} *2)) OVER (ORDER BY ${items.order})))/2`.as(
          'next',
        ),
      })
      .from(items)
      .where(and(...whereConditions))
      .orderBy(orderDirection(sql.raw('next')))
      .limit(1);

    return result?.[0]?.next ? +result?.[0]?.next : DEFAULT_ORDER;
  }

  /**
   * Return the first valid order value to use for inserting a new item at the beginning of the list, or whether there's no list.
   * This value is smaller than the smallest order that already exists.
   * If the parent item does not have children, it will return `undefined`
   * @param parentPath scope of the order
   * @returns {number|null} first valid order value, can be `null` for root
   */
  async getFirstOrderValue(
    dbConnection: DBConnection,
    parentPath?: ItemRaw['path'],
  ): Promise<number | null> {
    // no order for root
    if (!parentPath) {
      return null;
    }

    const result = await dbConnection
      .select({ order: items.order })
      .from(items)
      .where(and(isDescendantOrSelf(items.path, parentPath), ne(items.path, parentPath)))
      .orderBy(asc(items.order))
      .limit(1);

    if (result.length && result[0].order) {
      return result[0].order / 2;
    }
    return DEFAULT_ORDER;
  }

  async reorder(
    dbConnection: DBConnection,
    item: ItemRaw,
    parentPath: ItemRaw['path'],
    previousItemId?: string,
  ): Promise<ItemRaw> {
    // no defined previous item is set at beginning
    let order;
    if (!previousItemId) {
      // warning: by design reordering among one item will decrease this item order
      order = await this.getFirstOrderValue(dbConnection, parentPath);
    } else {
      order = await this.getNextOrderCount(dbConnection, parentPath, previousItemId);
    }
    await dbConnection.update(itemsRawTable).set({ order }).where(eq(itemsRawTable.id, item.id));

    // TODO: optimize
    return await this.getOneOrThrow(dbConnection, item.id);
  }

  async rescaleOrder(dbConnection: DBConnection, parentItem: FolderItem): Promise<void> {
    const children = await this.getChildren(dbConnection, parentItem);

    // no need to rescale for less than 2 items
    if (children.length < 2) {
      return;
    }

    // rescale if some children have the same values or if a child does not have an order value
    // these cases shouldn't happen otherwise it will lead to flickering
    const hasNullOrder = children.some(({ order }) => !order);
    const hasDuplicatedOrder = new Set(children.map(({ order }) => order)).size !== children.length;

    const minInterval = (arr) =>
      Math.min(...arr.slice(1).map((val, key) => Math.abs(val - arr[key])));
    const min = minInterval(children.map(({ order }) => order));

    if (min < RESCALE_ORDER_THRESHOLD || hasNullOrder || hasDuplicatedOrder) {
      // rescale order from multiple of default order
      const values: Pick<ItemRaw, 'id' | 'order'>[] = children.map(({ id }, idx) => ({
        id,
        order: DEFAULT_ORDER * (idx + 1),
      }));

      // can update in disorder
      const updates = await Promise.allSettled(
        values.map(async (i) => {
          return await dbConnection.update(itemsRawTable).set(i).where(eq(itemsRawTable.id, i.id));
        }),
      );
      const error = updates.find((u) => u.status === 'rejected');
      if (error) {
        throw new ItemOrderingError(error.reason);
      }
    }
  }

  /**
   *  get accessible items for actor and given params
   *  */
  async getAccessibleItems(
    dbConnection: DBConnection,
    account: MinimalMember,
    {
      creatorId,
      keywords,
      sortBy = SortBy.ItemUpdatedAt,
      ordering = Ordering.DESC,
      permissions,
      types,
    }: ItemSearchParams,
    pagination: Pagination,
  ): Promise<Paginated<ItemWithCreator>> {
    const { page, pageSize } = pagination;
    const limit = Math.min(pageSize, ITEMS_PAGE_SIZE_MAX);
    const skip = (page - 1) * limit;

    const andConditions: (SQL<unknown> | undefined)[] = [];
    if (creatorId) {
      andConditions.push(eq(items.creatorId, creatorId));
    }
    if (permissions?.length) {
      andConditions.push(inArray(itemMembershipsTable.permission, permissions));
    }
    if (types?.length) {
      andConditions.push(inArray(items.type, types));
    }

    // keyword search
    const allKeywords = keywords?.filter((s) => s && s.length);
    if (allKeywords && allKeywords.length) {
      const keywordsString = allKeywords.join(' ');

      // gather distinct involved languages, from actor
      const memberLang = account.lang ?? DEFAULT_LANG;
      const langs = ['simple', getSearchLang(memberLang), transformLangToReconfigLang(items.lang)];

      andConditions.push(
        or(
          // search with involved languages
          ...langs.map((l) => itemFullTextSearch(items, l, keywordsString)),
          // raw words search
          ...keywordSearch(items.name, allKeywords),
        ),
      );
    }

    // for account, get all direct items that have permissions, ordered by path
    const itemAndOrderedMemberships = dbConnection
      .select({
        ...getViewSelectedFields(items),
        rNb: sql`row_number() OVER (ORDER BY path)`.as('row_number'),
      })
      .from(items)
      .innerJoin(
        itemMembershipsTable,
        and(
          eq(itemMembershipsTable.itemPath, items.path),
          eq(itemMembershipsTable.accountId, account.id),
        ),
      )
      .where(and(...andConditions))
      .orderBy(asc(items.path));

    const iom = itemAndOrderedMemberships.as('item_and_ordered_membership');
    const join = itemAndOrderedMemberships.as('join');

    let orderBy = desc(iom.updatedAt);
    if (sortBy) {
      // map strings to correct sort by column
      let mappedSortBy;
      switch (sortBy) {
        case SortBy.ItemType:
          mappedSortBy = iom.type;
          break;
        case SortBy.ItemUpdatedAt:
          mappedSortBy = iom.updatedAt;
          break;
        case SortBy.ItemCreatedAt:
          mappedSortBy = iom.createdAt;
          break;
        case SortBy.ItemName:
          mappedSortBy = iom.name;
          break;
        case SortBy.ItemCreatorName:
          mappedSortBy = membersView.name;
          break;
      }
      if (mappedSortBy) {
        orderBy =
          orderingToUpperCase(ordering) === Ordering.ASC ? asc(mappedSortBy) : desc(mappedSortBy);
      }
    }

    // select top most items from above subquery
    const result = await dbConnection
      .select()
      .from(iom)
      .leftJoin(membersView, eq(iom.creatorId, membersView.id))
      .where(
        lte(
          iom.rNb,
          dbConnection
            .select({ rNb: join.rNb })
            .from(join)
            .where(isAncestorOrSelf(join.path, iom.path))
            .orderBy(asc(join.rNb))
            .limit(1),
        ),
      )
      .orderBy(orderBy)
      .offset(skip)
      .limit(limit);

    return {
      data: result.map(({ item_and_ordered_membership, members_view }) => ({
        ...item_and_ordered_membership,
        creator: members_view as MemberRaw | null,
      })),
      pagination: { page, pageSize },
    };
  }

  /**
   * Fix order of tree
   * @param dbConnection database connection
   * @param parentPath root of tree to be fixed
   */
  async fixOrderForTree(dbConnection: DBConnection, parentPath: string) {
    // get parents within tree that has corrupted order numbers (eg. twice the same value)
    const parentsWithSameOrder = dbConnection.$with('parents_with_same_order').as(
      dbConnection
        .select({ parent: sql.raw('subpath(path, 0, -1)').as('parent') })
        .from(itemsRawTable)
        .where(
          and(sql.raw('nlevel(path) >= 2'), isDescendantOrSelf(itemsRawTable.path, parentPath)),
        )
        .groupBy(sql.raw('parent'))
        .having(and(gt(count(), 1), lt(countDistinct(itemsRawTable.order), count()))),
    );

    // for each children under parent, set a row number based on sorted items (by order, by creation date)
    const siblings = dbConnection.$with('siblings').as(
      dbConnection
        .with(parentsWithSameOrder)
        .select({
          id: itemsRawTable.id,
          created_at: itemsRawTable.createdAt,
          parent: sql.raw('subpath(path, 0, -1)'),
          newOrder: sql
            .raw(
              'CAST(ROW_NUMBER() OVER (PARTITION BY subpath(path, 0, -1) ORDER BY "order", created_at) as INT)',
            )
            .as('newOrder'),
        })
        .from(itemsRawTable)
        .innerJoin(
          parentsWithSameOrder,
          eq(sql`subpath(${itemsRawTable.path}, 0, -1)`, parentsWithSameOrder.parent),
        )
        .where(sql.raw('nlevel(path) >= 2')),
    );

    // set correct order
    await dbConnection
      .with(siblings)
      .update(itemsRawTable)
      .set({ order: sql`${siblings.newOrder} * ${DEFAULT_ORDER}` })
      .from(siblings)
      .where(eq(itemsRawTable.id, siblings.id));
  }
}
