import { isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  SQL,
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lte,
  ne,
  sql,
} from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';
import { v4 } from 'uuid';

import {
  FileItemType,
  ItemSettings,
  ItemType,
  MAX_ITEM_NAME_LENGTH,
  MAX_TREE_LEVELS,
  Paginated,
  Pagination,
  PermissionLevel,
  ResultOf,
  buildPathFromIds,
  getChildFromPath,
  getParentFromPath,
} from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import { DBConnection } from '../../drizzle/db';
import { isAncestorOrSelf, isDescendantOrSelf, isDirectChild } from '../../drizzle/operations';
import {
  accountsTable,
  itemColumns,
  itemMemberships,
  items,
  itemsRaw,
  membersView,
  publishedItems,
} from '../../drizzle/schema';
import {
  Item,
  ItemRaw,
  ItemTypeEnumKeys,
  ItemTypeUnion,
  ItemWithCreator,
  MemberRaw,
  MinimalItemForInsert,
} from '../../drizzle/types';
import { IllegalArgumentException } from '../../repositories/errors';
import { AuthenticatedUser, MaybeUser, MinimalMember } from '../../types';
import {
  HierarchyTooDeep,
  InvalidMoveTarget,
  ItemNotFolder,
  ItemNotFound,
  NothingToUpdateItem,
  TooManyDescendants,
  UnexpectedError,
} from '../../utils/errors';
import {
  FILE_METADATA_DEFAULT_PAGE_SIZE,
  FILE_METADATA_MAX_PAGE_SIZE,
  FILE_METADATA_MIN_PAGE,
} from '../member/constants';
import { mapById } from '../utils';
import { DEFAULT_ORDER, IS_COPY_REGEX, ITEMS_PAGE_SIZE_MAX } from './constants';
import { FolderItem, isItemType } from './discrimination';
import {
  ItemChildrenParams,
  ItemSearchParams,
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
  item: Partial<Item> & Pick<Item, 'name' | 'type'>;
  creator: MinimalMember;
  parentItem?: Item;
};

@singleton()
export class ItemRepository {
  constructor() {}

  checkHierarchyDepth(item: Item, additionalNbLevel = 1): void {
    // check if hierarchy it too deep
    // adds nb of items to be created
    const itemDepth = item.path.split('.').length;
    if (itemDepth + additionalNbLevel > MAX_TREE_LEVELS) {
      throw new HierarchyTooDeep();
    }
  }

  async checkNumberOfDescendants(db: DBConnection, item: Item, maximum: number): Promise<void> {
    // check how "big the tree is" below the item

    const [{ count: numberOfDescendants }] = await db
      .select({ count: count() })
      .from(items)
      .where(isDescendantOrSelf(items.path, item.path));

    if (numberOfDescendants > maximum) {
      throw new TooManyDescendants(item.id);
    }
  }

  /**
   * build item based on propeties
   * does not save it
   */
  createOne(args: {
    name: Item['name'];
    description?: Item['description'];
    type?: Item['type'];
    extra?: Item['extra'];
    settings?: Item['settings'];
    creator: MinimalMember;
    lang?: Item['lang'];
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

  // TODO: note: removed , options = { withDeleted: false }
  async getOne(db: DBConnection, id: string): Promise<ItemWithCreator | null> {
    const results = await db
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

  // TODO: note: removed  options: Pick<FindOneOptions<Item>, 'withDeleted'> = { withDeleted: false },
  async getOneOrThrow(db: DBConnection, id: string): Promise<ItemWithCreator> {
    const result = await db
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

  // TODO: note: removed  options: Pick<FindOneOptions<Item>, 'withDeleted'> = { withDeleted: false },
  async getDeletedById(db: DBConnection, id: string): Promise<Item> {
    const item = await db
      .select()
      .from(itemsRaw)
      .where(and(eq(itemsRaw.id, id), isNotNull(itemsRaw.deletedAt)))
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
  async getAncestors(db: DBConnection, item: Item): Promise<ItemWithCreator[]> {
    if (!item.path.includes('.')) {
      return [];
    }

    const result = await db
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

  async getChildren(
    db: DBConnection,
    actor: MaybeUser,
    parent: Item,
    params?: ItemChildrenParams,
  ): Promise<ItemWithCreator[]> {
    if (parent.type !== ItemType.FOLDER) {
      throw new ItemNotFolder({ id: parent.id });
    }

    // reunite where conditions
    // is direct child
    const andConditions: (SQL | undefined)[] = [isDirectChild(items.path, parent.path)];

    // .where('path ~ ${${parent.path}.*{1}}', { path: `${parent.path}.*{1}` });

    if (params?.types) {
      const types = params.types;
      andConditions.push(inArray(items.type, types));
    }

    // TODO: enable back
    // const allKeywords = params?.keywords?.filter((s) => s && s.length);
    // if (allKeywords?.length) {
    //   const keywordsString = allKeywords.join(' ');

    //   // search in english by default
    //   const matchEnglishSearchCondition = sql`${items.searchDocument} @@ plainto_tsquery('english', ${keywordsString})`;

    //   // no dictionary
    //   const matchSimpleSearchCondition = sql`${items.searchDocument} @@ plainto_tsquery('simple', ${keywordsString})`;

    //   // raw words search
    //   const matchRawWordSearchConditions = allKeywords.map((k) => ilike(items.name, `%${k}%`));

    //   const searchConditions = [
    //     matchEnglishSearchCondition,
    //     matchSimpleSearchCondition,
    //     ...matchRawWordSearchConditions,
    //   ];

    //   // search by member lang
    //   const memberLang = actor && isMember(actor) ? actor?.lang : DEFAULT_LANG;
    //   if (memberLang && ALLOWED_SEARCH_LANGS[memberLang]) {
    //     const matchMemberLangSearchCondition = sql`${items.searchDocument} @@ plainto_tsquery(${ALLOWED_SEARCH_LANGS[memberLang]}, ${keywordsString})`;
    //     searchConditions.push(matchMemberLangSearchCondition);
    //   }

    //   andConditions.push(or(...searchConditions));
    // }

    // use createdAt for ordering by default
    // or use order for ordering
    let orderByValues = [asc(items.createdAt)];
    if (params?.ordered) {
      // backup order by in case two items has same ordering
      orderByValues = [asc(items.order), asc(items.createdAt)];
    }

    // normally no need anymore with typeorm
    // if (options.withOrder) {
    //   query.addSelect('item.order');
    // }

    const result = await db
      .select()
      .from(items)
      .leftJoin(membersView, eq(items.creatorId, membersView.id))
      .where(and(...andConditions))
      .orderBy(() => orderByValues);

    return result.map(({ item_view, members_view }) => ({
      ...item_view,
      creator: members_view as MemberRaw,
    }));
  }

  async getChildrenNames(
    db: DBConnection,
    parent: Item,
    { startWith }: { startWith?: string },
  ): Promise<string[]> {
    const whereConditions = [isDirectChild(items.path, parent.path)];

    if (startWith) {
      whereConditions.push(ilike(items.name, `${startWith}%`));
    }

    const itemNames = await db
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
    db: DBConnection,
    item: FolderItem,
    options?: { ordered?: boolean; types?: ItemTypeUnion[] },
  ): Promise<ItemWithCreator[]> {
    // TODO: LEVEL depth
    const { ordered = true, types } = options ?? {};

    const whereConditions = [isDescendantOrSelf(items.path, item.path), ne(items.id, item.id)];
    if (types && types.length > 0) {
      whereConditions.push(inArray(items.type, types));
    }

    // TODO: no need with drizzle
    // need order column to further sort in this function or afterwards
    // if (ordered || selectOrder) {
    //   query.addSelect('item.order');
    // }
    // if (!ordered) {
    //   return query.getMany();
    // }

    const result = await db
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

  // async getManyDescendants(
  //   db: DBConnection,
  //   items: Item[],
  //   { withDeleted = false }: { withDeleted?: boolean } = {},
  // ): Promise<Item[]> {
  //   // TODO: LEVEL depth
  //   if (items.length === 0) {
  //     return [];
  //   }
  //   const query = this.repository.createQueryBuilder('item');

  //   if (withDeleted) {
  //     query.withDeleted();
  //   }

  //   // query.leftJoinAndSelect('item.creator', 'creator').where('item.id NOT IN(:...ids)', {
  //   //   ids: items.map(({ id }) => id),
  //   // });

  //   // query.andWhere(
  //   //   new Brackets((q) => {
  //   //     items.forEach((item) => {
  //   //       const key = `path_${item.path}`;
  //   //       q.orWhere(`item.path <@ :${key}`, { [key]: item.path });
  //   //     });
  //   //   }),
  //   // );

  //   return query.getMany();

  //   const whereConditions = [isDescendantOrSelf(items.path, item.path), ne(items.id, item.id)];

  //   // TODO: no need with drizzle
  //   // need order column to further sort in this function or afterwards
  //   // if (ordered || selectOrder) {
  //   //   query.addSelect('item.order');
  //   // }
  //   // if (!ordered) {
  //   //   return query.getMany();
  //   // }

  //   const result = await db
  //     .select()
  //     .from(items)
  //     .leftJoin(membersView, eq(items.creatorId, membersView.id))
  //     .where(and(...whereConditions))
  //     .orderBy(asc(items.path));

  //   const descendants = result.map(({ members_view, item_view }) => ({
  //     ...item_view,
  //     creator: members_view as MemberRaw,
  //   }));

  //   return sortChildrenForTreeWith<ItemWithCreator>(descendants, item);
  // }

  async getMany(
    db: DBConnection,
    ids: string[],
    args: { throwOnError?: boolean; withDeleted?: boolean } = {},
  ): Promise<ResultOf<ItemWithCreator>> {
    if (!ids.length) {
      return { data: {}, errors: [] };
    }

    const { throwOnError = false } = args;

    // TODO: needed??
    // withDeleted: Boolean(args.withDeleted),
    // order: args.ordered ? { order: 'ASC' } : {},

    const result = (
      await db
        .select()
        .from(items)
        .leftJoin(accountsTable, eq(items.creatorId, accountsTable.id))
        .where(inArray(items.id, ids))
    ).map(({ account, item_view }) => ({
      ...item_view,
      creator: account as MemberRaw,
    }));

    const mappedResult = mapById({
      keys: ids,
      findElement: (id) => result.find(({ id: thisId }) => thisId === id),
      buildError: (id) => new ItemNotFound(id),
    });

    if (throwOnError && mappedResult.errors.length) {
      throw mappedResult.errors[0];
    }

    return mappedResult;
  }

  async getNumberOfLevelsToFarthestChild(db: DBConnection, item: Item): Promise<number> {
    const farthestItem = await db
      .select({ path: items.path })
      .from(items)
      .where(and(isDescendantOrSelf(items.path, item.path), ne(items.id, item.id)))
      .orderBy(desc(sql`nlevel(path)`))
      .limit(1);
    // await this.repository
    //   .createQueryBuilder('item')
    //   .addSelect(`nlevel(path) - nlevel('${item.path}')`)
    //   .where('item.path <@ :path', { path: item.path })
    //   .andWhere('id != :id', { id: item.id })
    //   .orderBy('nlevel(path)', 'DESC')
    //   .limit(1)
    //   .getOne();
    return farthestItem?.[0]?.path?.split('.')?.length ?? 0;
  }

  async getOwn(db: DBConnection, memberId: string): Promise<Item[]> {
    const result = await db
      .select()
      .from(items)
      .leftJoin(accountsTable, eq(items.creatorId, accountsTable.id))
      .innerJoin(itemMemberships, isDescendantOrSelf(itemMemberships.itemPath, items.path))
      .where(
        and(
          eq(items.creatorId, memberId),
          eq(itemMemberships.permission, PermissionLevel.Admin),
          eq(sql`nlevel(${items.path})`, 1),
        ),
      )
      .orderBy(desc(items.updatedAt));

    return result.map(({ account, item_view }) => ({
      ...item_view,
      creator: account,
    }));

    // return this.repository
    //   .createQueryBuilder('item')
    //   .leftJoinAndSelect('item.creator', 'creator')
    //   .innerJoin('item_membership', 'im', 'im.item_path @> item.path')
    //   .where('creator.id = :id', { id: memberId })
    //   .andWhere('im.permission = :permission', { permission: PermissionLevel.Admin })
    //   .andWhere('nlevel(item.path) = 1')
    //   .orderBy('item.updatedAt', 'DESC')
    //   .getMany();
  }

  async move(db: DBConnection, item: Item, parentItem?: Item): Promise<Item> {
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
      ? sql`${parentItem.path} || subpath(${itemsRaw.path}, nlevel(${item.path}) - 1)`
      : sql`subpath(${itemsRaw.path}, nlevel(${item.path}) - 1)`;

    // get new order value
    const order = await this.getNextOrderCount(db, parentItem?.path);

    const res = await db
      .update(itemsRaw)
      .set({ path: pathSql, order })
      .where(isDescendantOrSelf(itemsRaw.path, item.path))
      .returning();
    return res[0];
    // this.repository
    //   .createQueryBuilder('item')
    //   .update()
    //   .set({ path: () => pathSql, order })
    //   .where('item.path <@ :path', { path: item.path })
    //   .execute();
  }

  async updateOne(db: DBConnection, id: string, data: Partial<Item>): Promise<Item> {
    // update only if data is not empty
    if (!Object.keys(data).length) {
      throw new IllegalArgumentException("The item's body cannot be empty!");
    }

    // TODO: extra + settings
    const item = await this.getOneOrThrow(db, id);

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
    return (await db.update(itemsRaw).set(newData).where(eq(itemsRaw.id, id)).returning())[0];
  }

  public async addOne(db: DBConnection, { item, creator, parentItem }: CreateItemBody) {
    const newItem = this.createOne({
      ...item,
      creator,
      parent: parentItem,
    });

    const result = await db.insert(itemsRaw).values(newItem).returning();

    return result[0];
  }

  public async addMany(
    db: DBConnection,
    items: (Partial<Item> & Pick<Item, 'name' | 'type'>)[],
    creator: MinimalMember,
    parent?: Item,
  ): Promise<ItemRaw[]> {
    const newItems = items.map((item) =>
      this.createOne({
        ...item,
        creator,
        parent,
      }),
    );

    const result = await db.insert(itemsRaw).values(newItems).returning();

    return result;
  }

  /////// -------- COPY
  async copy(
    db: DBConnection,
    item: Item,
    creator: MinimalMember,
    siblingsName: string[],
    parentItem?: FolderItem,
  ): Promise<{
    copyRoot: Item;
    treeCopyMap: Map<string, { original: Item; copy: MinimalItemForInsert }>;
  }> {
    // cannot copy inside non folder item
    if (parentItem && parentItem.type !== ItemType.FOLDER) {
      throw new ItemNotFolder({ id: parentItem.id });
    }

    // copy (memberships from origin are not copied/kept)
    const treeItemsCopy = await this._copy(db, item, creator, siblingsName, parentItem);

    // return copy item + all descendants
    const newItems = [...treeItemsCopy.values()].map(({ copy }) => copy);
    const createdItems = await db.insert(itemsRaw).values(newItems).returning();

    const newItemRef = createdItems[0];
    if (!newItemRef) {
      throw new UnexpectedError({ operation: 'copy', itemId: item.id });
    }

    return {
      copyRoot: await this.getOneOrThrow(db, newItemRef.id),
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
    db: DBConnection,
    original: Item,
    creator: MinimalMember,
    siblingsName: string[],
    parentItem?: FolderItem,
  ) {
    const old2New = new Map<string, { copy: MinimalItemForInsert; original: Item }>();

    // get next order value
    const order = await this.getNextOrderCount(db, parentItem?.path);
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
      await this.copyDescendants(db, original, creator, old2New);
    }

    return old2New;
  }

  /**
   * add in map generated copies for descendants of item, in given map
   * @param original
   * @param old2New mapping from original item to copied data, in-place updates
   */
  private async copyDescendants(
    db: DBConnection,
    original: FolderItem,
    creator: MinimalMember,
    old2New: Map<string, { copy: MinimalItemForInsert; original: Item }>,
  ): Promise<void> {
    const descendants = await this.getDescendants(db, original, {
      ordered: true,
    });
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
  async getItemSumSize(
    db: DBConnection,
    memberId: string,
    itemType: FileItemType,
  ): Promise<number> {
    const result = await db
      .select({
        total: sql<string>`SUM(((${items.extra}::jsonb->${itemType})::jsonb->'size')::bigint)`,
      })
      .from(items)
      .where(and(eq(items.creatorId, memberId), eq(items.type, itemType)));
    const [{ total }] = result;
    return parseInt(total ?? 0);
  }

  async getFilesMetadata(
    db: DBConnection,
    memberId: string,
    itemType: FileItemType,
    { page = FILE_METADATA_MIN_PAGE, pageSize = FILE_METADATA_DEFAULT_PAGE_SIZE }: Pagination,
  ) {
    const limit = Math.min(pageSize, FILE_METADATA_MAX_PAGE_SIZE);
    const skip = (page - 1) * limit;

    // bug: it is important to select manually the fields we need, as alias on a view does not automatically generate the correct return values (wrong alias name)
    const parentTable = alias(items, 'parent');
    const result = await db
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
      // .leftJoinAndSelect(
      //   'item',
      //   'parent',
      //   'parent.path = subpath(item.path, 0, nlevel(item.path) - 1)',
      // )
      .where(and(eq(items.creatorId, memberId), eq(items.type, itemType)))
      .offset(skip)
      // order by size
      .orderBy(desc(sql`(${items.extra}::json -> ${itemType} ->> 'size')::decimal`))
      .limit(limit);

    const entities = result.map(({ parentName, parentId, extra, ...item }) => ({
      ...item,
      size: extra[itemType].size,
      path: extra[itemType].path,
      parent: parentId
        ? {
            id: parentId,
            name: parentName,
          }
        : undefined,
    }));

    const [{ totalCount }] = await db
      .select({ totalCount: count() })
      .from(items)
      .where(and(eq(items.creatorId, memberId), eq(items.type, itemType)));

    return { data: entities, totalCount: totalCount };
  }

  /**
   * Return published items for given member
   * @param memberId
   * @returns published items for given member
   */
  async getPublishedItemsForMember(
    db: DBConnection,
    memberId: MinimalMember['id'],
  ): Promise<ItemWithCreator[]> {
    // get for membership write and admin -> createquerybuilder
    const result = await db
      .select()
      .from(items)
      .innerJoin(publishedItems, eq(publishedItems.itemPath, items.path))
      .innerJoin(
        itemMemberships,
        and(
          isAncestorOrSelf(itemMemberships.itemPath, items.path),
          inArray(itemMemberships.permission, [PermissionLevel.Admin, PermissionLevel.Write]),
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

  // TODO: remove??
  async findAndCount(
    db: DBConnection,
    args: { where: { type: ItemTypeEnumKeys }; take: number; skip: number; order: SQL },
  ): Promise<[Item[], number]> {
    const result = await db
      .select()
      .from(items)
      .where(eq(items.type, args.where.type))
      .orderBy(args.order)
      .limit(args.take)
      .offset(args.skip);

    const totalCount = (
      await db.select({ count: count() }).from(items).where(eq(items.type, args.where.type))
    )[0].count;

    return [result, totalCount];
  }
  async delete(db: DBConnection, args: Item['id'][]): Promise<void> {
    await db.delete(itemsRaw).where(inArray(itemsRaw.id, args));
  }
  async softRemove(db: DBConnection, args: Item[]): Promise<void> {
    await db
      .update(itemsRaw)
      .set({ deletedAt: new Date().toISOString() })
      .where(
        inArray(
          itemsRaw.id,
          args.map(({ id }) => id),
        ),
      );
  }
  async recover(db: DBConnection, args: Item[]): Promise<void> {
    await db
      .update(itemsRaw)
      .set({ deletedAt: null })
      .where(
        inArray(
          itemsRaw.id,
          args.map(({ id }) => id),
        ),
      );
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
    db: DBConnection,
    parentPath?: Item['path'],
    previousItemId?: Item['id'],
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
      const previousItems = await db
        .select({ id: items.id, order: items.order })
        .from(items)
        .where(and(eq(items.id, previousItemId), isDirectChild(items.path, parentPath)))
        .limit(1);

      // const previousItem = await this.repository
      //   .createQueryBuilder()
      //   .select(['id', '"order"'])
      //   .where('id = :previousItemId', { previousItemId })
      //   // ensure it is a child of parent
      //   .andWhere('path ~ :path', { path: `${parentPath}.*{1}` })
      //   .getRawOne();

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
    const result = await db
      .select({
        next: sql<number>`(${items.order} + (lead(${items.order}, 1, ${items.order} + ( ${DEFAULT_ORDER} *2)) OVER (ORDER BY ${items.order})))/2`.as(
          'next',
        ),
      })
      .from(items)
      .where(and(...whereConditions))
      .orderBy(orderDirection(sql.raw('next')))
      .limit(1);

    // .createQueryBuilder('item')
    // // default value: self order + "default order value" to increase of one the order
    // .select(
    //   '(item.order + (lead(item.order, 1, item.order + (' +
    //     DEFAULT_ORDER +
    //     '*2)) OVER (ORDER BY item.order)))/2',
    //   'next',
    // )
    // .where('path <@ :path', { path: parentPath })
    // .andWhere('path != :path', { path: parentPath });

    return result?.[0]?.next ? +result?.[0]?.next : DEFAULT_ORDER;
  }

  /**
   * Return the first valid order value to use for inserting a new item at the beginning of the list, or whether there's no list.
   * This value is smaller than the smallest order that already exists.
   * If the parent item does not have children, it will return `undefined`
   * @param parentPath scope of the order
   * @returns {number|null} first valid order value, can be `null` for root
   */
  async getFirstOrderValue(db: DBConnection, parentPath?: Item['path']): Promise<number | null> {
    // no order for root
    if (!parentPath) {
      return null;
    }

    const result = await db
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
    db: DBConnection,
    item: Item,
    parentPath: Item['path'],
    previousItemId?: string,
  ): Promise<Item> {
    // no defined previous item is set at beginning
    let order;
    if (!previousItemId) {
      // warning: by design reordering among one item will decrease this item order
      order = await this.getFirstOrderValue(db, parentPath);
    } else {
      order = await this.getNextOrderCount(db, parentPath, previousItemId);
    }
    await db.update(itemsRaw).set({ order }).where(eq(itemsRaw.id, item.id));

    // TODO: optimize
    return await this.getOneOrThrow(db, item.id);
  }

  async rescaleOrder(db: DBConnection, actor: AuthenticatedUser, parentItem: Item): Promise<void> {
    const children = await this.getChildren(db, actor, parentItem);

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
      await Promise.all(
        values.map(async (i) => {
          return await db.update(itemsRaw).set(i).where(eq(itemsRaw.id, i.id));
        }),
      );
    }
  }

  /**
   *  get accessible items for actor and given params
   *  */
  async getAccessibleItems(
    db: DBConnection,
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

    //     WITH item_and_ordered_membership AS
    // (SELECT i.*, row_number() OVER (ORDER BY path) r_nb FROM "item" "i" INNER JOIN "item_membership" "im" ON "i"."path" = "im"."item_path" AND "im"."account_id" = '589efade-b88b-4809-a892-ec39843489e7' WHERE "i"."deleted_at" IS NULL ORDER BY "i"."path" ASC)
    // SELECT *
    // FROM item_and_ordered_membership "iom"
    // WHERE r_nb <= (SELECT r_nb FROM item_and_ordered_membership WHERE item_and_ordered_membership.path @> iom.path order by r_nb limit 1)
    // order by iom.updated_at desc
    // ;

    const andConditions = [isNull(itemsRaw.deletedAt)];
    if (creatorId) {
      andConditions.push(eq(itemsRaw.creatorId, creatorId));
    }
    if (permissions?.length) {
      andConditions.push(inArray(itemMemberships.permission, permissions));
    }
    if (types?.length) {
      andConditions.push(inArray(itemsRaw.type, types));
    }

    // for account, get all direct items that have permissions, ordered by path
    // TODO: use (getViewSelectedFields(items)); to use item view
    const itemAndOrderedMemberships = db
      .select({
        ...itemColumns,
        rNb: sql`row_number() OVER (ORDER BY path)`.as('row_number'),
      })
      .from(itemsRaw)
      .innerJoin(
        itemMemberships,
        and(eq(itemMemberships.itemPath, itemsRaw.path), eq(itemMemberships.accountId, account.id)),
      )
      .where(and(...andConditions))
      .orderBy(asc(itemsRaw.path));

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

    // TODO: COMPLETE WITH SEARCH AND EVERYTHING
    // select top most items from above subquery
    const result = await db
      .select()
      .from(iom)
      .leftJoin(membersView, eq(iom.creatorId, membersView.id))
      .where(
        lte(
          iom.rNb,
          db
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

    // TODO: optimize
    const [{ totalCount }] = await db
      .select({ totalCount: count() })
      .from(iom)
      .where(
        lte(
          iom.rNb,
          db
            .select({ rNb: join.rNb })
            .from(join)
            .where(isAncestorOrSelf(join.path, iom.path))
            .orderBy(asc(join.rNb))
            .limit(1),
        ),
      );

    // TODO: pagination
    return {
      data: result.map(({ item_and_ordered_membership, members_view }) => ({
        ...item_and_ordered_membership,
        creator: members_view as MemberRaw | null,
      })),
      totalCount,
      pagination: { page, pageSize },
    };

    // const query = await db
    //   .select()
    //   .from(itemMembershipTable)
    //   .leftJoin(items, eq(itemMembershipTable.itemPath, items.path))
    //   .leftJoin(membersView, eq(membersView.id, items.creatorId))
    //   .where(eq(itemMembershipTable.accountId, account.id))
    //   // returns only top most item
    //   .andWhere((qb) => {
    //     const subQuery = qb
    //       .subQuery()
    //       .from(itemMembershipTable, 'im1')
    //       .select('im1.item.path')
    //       .where('im.item_path <@ im1.item_path')
    //       .andWhere('im1.account_id = :actorId', { actorId: account.id })
    //       .orderBy('im1.item_path', 'ASC')
    //       .limit(1);

    //     if (permissions) {
    //       subQuery.andWhere('im1.permission IN (:...permissions)', { permissions });
    //     }
    //     return 'item.path =' + subQuery.getQuery();
    //   });

    // const allKeywords = keywords?.filter((s) => s && s.length);
    // if (allKeywords?.length) {
    //   const keywordsString = allKeywords.join(' ');
    //   query.andWhere(
    //     new Brackets((q) => {
    //       // search in english by default
    //       q.where("item.search_document @@ plainto_tsquery('english', :keywords)", {
    //         keywords: keywordsString,
    //       });

    //       // no dictionary
    //       q.orWhere("item.search_document @@ plainto_tsquery('simple', :keywords)", {
    //         keywords: keywordsString,
    //       });

    //       // raw words search
    //       allKeywords.forEach((k, idx) => {
    //         q.orWhere(`item.name ILIKE :k_${idx}`, {
    //           [`k_${idx}`]: `%${k}%`,
    //         });
    //       });

    //       // search by member lang
    //       const memberLang = isMember(account) ? account.lang : DEFAULT_LANG;
    //       const memberLangKey = memberLang as keyof typeof ALLOWED_SEARCH_LANGS;
    //       if (memberLang != DEFAULT_LANG && ALLOWED_SEARCH_LANGS[memberLangKey]) {
    //         q.orWhere('item.search_document @@ plainto_tsquery(:lang, :keywords)', {
    //           keywords: keywordsString,
    //           lang: ALLOWED_SEARCH_LANGS[memberLangKey],
    //         });
    //       }
    //     }),
    //   );
    // }

    // if (creatorId) {
    //   query.andWhere('item.creator = :creatorId', { creatorId });
    // }

    // if (permissions) {
    //   query.andWhere('im.permission IN (:...permissions)', { permissions });
    // }

    // if (types) {
    //   query.andWhere('item.type IN (:...types)', { types });
    // }

    // if (sortBy) {
    //   // map strings to correct sort by column
    //   let mappedSortBy;
    //   switch (sortBy) {
    //     case SortBy.ItemType:
    //       mappedSortBy = 'item.type';
    //       break;
    //     case SortBy.ItemUpdatedAt:
    //       mappedSortBy = 'item.updated_at';
    //       break;
    //     case SortBy.ItemCreatedAt:
    //       mappedSortBy = 'item.created_at';
    //       break;
    //     case SortBy.ItemCreatorName:
    //       mappedSortBy = 'creator.name';
    //       break;
    //     case SortBy.ItemName:
    //       mappedSortBy = 'item.name';
    //       break;
    //   }
    //   if (mappedSortBy) {
    //     query.orderBy(mappedSortBy, orderingToUpperCase(ordering));
    //   }
    // }

    // const [im, totalCount] = await query.offset(skip).limit(limit).getManyAndCount();
    // return { data: im, totalCount, pagination };
  }
}
