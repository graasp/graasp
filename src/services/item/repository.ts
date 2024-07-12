import { Brackets, EntityManager, FindManyOptions, In, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { v4 } from 'uuid';

import {
  FileItemType,
  ItemSettings,
  ItemType,
  MAX_ITEM_NAME_LENGTH,
  MAX_TREE_LEVELS,
  PermissionLevel,
  buildPathFromIds,
  getChildFromPath,
  getParentFromPath,
} from '@graasp/sdk';

import { AppDataSource } from '../../plugins/datasource';
import {
  HierarchyTooDeep,
  InvalidMoveTarget,
  ItemNotFolder,
  ItemNotFound,
  TooManyDescendants,
  UnexpectedError,
} from '../../utils/errors';
import { MemberIdentifierNotFound } from '../itemLogin/errors';
import { Member } from '../member/entities/member';
import { itemSchema } from '../member/plugins/export-data/schemas/schemas';
import { schemaToSelectMapper } from '../member/plugins/export-data/utils/selection.utils';
import { mapById } from '../utils';
import { DEFAULT_ORDER, FolderItem, Item, ItemExtraUnion, isItemType } from './entities/Item';
import { ItemChildrenParams } from './types';
import { sortChildrenForTreeWith } from './utils';

const DEFAULT_COPY_SUFFIX = ' (2)';
const IS_COPY_REGEX = /\s\(\d+\)$/;
const RESCALE_ORDER_THRESHOLD = 0.1;

const DEFAULT_THUMBNAIL_SETTING: ItemSettings = {
  hasThumbnail: false,
};

export class ItemRepository {
  private repository: Repository<Item>;

  constructor(manager?: EntityManager) {
    if (manager) {
      this.repository = manager.getRepository(Item);
    } else {
      this.repository = AppDataSource.getRepository(Item);
    }
  }

  checkHierarchyDepth(item: Item, additionalNbLevel = 1) {
    // check if hierarchy it too deep
    // adds nb of items to be created
    const itemDepth = item.path.split('.').length;
    if (itemDepth + additionalNbLevel > MAX_TREE_LEVELS) {
      throw new HierarchyTooDeep();
    }
  }

  async checkNumberOfDescendants(item: Item, maximum: number) {
    // check how "big the tree is" below the item

    const numberOfDescendants = await this.repository
      .createQueryBuilder('item')
      .where('item.path <@ :path', { path: item.path })
      .getCount();

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
    displayName?: Item['displayName'];
    description?: Item['description'];
    type?: Item['type'];
    extra?: Item['extra'];
    settings?: Item['settings'];
    creator: Item['creator'];
    lang?: Item['lang'];
    parent?: Item;
    order?: Item['order'];
  }) {
    const {
      name,
      displayName = '',
      description = null,
      parent,
      type = ItemType.FOLDER,
      extra,
      settings = {},
      lang,
      creator,
      order,
    } = args;

    if (parent && !isItemType(parent, ItemType.FOLDER)) {
      throw new ItemNotFolder(parent);
    }

    // TODO: extra
    // folder's extra can be empty
    let parsedExtra: ItemExtraUnion = extra ? JSON.parse(JSON.stringify(extra)) : {};
    const id = v4();

    // if item is a folder and the extra is empty, seed the childrenOrder
    if (type === ItemType.FOLDER && !(ItemType.FOLDER in parsedExtra)) {
      parsedExtra = { folder: { childrenOrder: [] } };
    }

    const item = this.repository.create({
      id,
      name,
      displayName,
      description,
      type,
      extra: parsedExtra,
      settings: {
        ...DEFAULT_THUMBNAIL_SETTING,
        ...settings,
      },
      // set lang from user lang
      lang: lang ?? creator?.lang ?? 'en',
      creator,
      order,
    });
    item.path = parent ? `${parent.path}.${buildPathFromIds(id)}` : buildPathFromIds(id);

    return item;
  }

  async deleteMany(ids: string[]): Promise<void> {
    await this.repository.delete(ids);
  }

  async get(id: string, options = { withDeleted: false }): Promise<Item> {
    // additional check that id is not null
    // o/w empty parameter to findOneBy return the first entry
    // TODO: improve

    const item = await this.repository.findOne({
      where: { id },
      relations: {
        creator: true,
      },
      ...options,
    });

    if (!item) {
      throw new ItemNotFound(id);
    }

    return item;
  }

  /**
   * options.includeCreator {boolean} if true, return full creator
   * options.types {boolean} if defined, filter out the items
   * */
  async getAncestors(item: Item): Promise<Item[]> {
    if (!item.path.includes('.')) {
      return [];
    }

    return this.repository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.creator', 'creator')
      .where('item.path @> :path', { path: item.path })
      .andWhere('item.id != :id', { id: item.id })
      .orderBy('path', 'ASC')
      .getMany();
  }

  async getChildren(
    parent: Item,
    params?: ItemChildrenParams,
    options: { withOrder?: boolean } = {},
  ): Promise<Item[]> {
    if (!isItemType(parent, ItemType.FOLDER)) {
      throw new ItemNotFolder(parent);
    }

    const query = this.repository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.creator', 'creator')
      .where('path ~ :path', { path: `${parent.path}.*{1}` });

    if (params?.types) {
      const types = params.types;
      query.andWhere('item.type IN (:...types)', { types });
    }

    if (params?.ordered) {
      query
        .orderBy('item.order', 'ASC')
        // backup order by in case two items has same ordering
        .addOrderBy('item.created_at', 'ASC');
    } else {
      query.orderBy('item.createdAt', 'ASC');
    }

    if (options.withOrder) {
      query.addSelect('item.order');
    }

    return query.getMany();
  }

  /**
   * Return tree below item
   * @param {Item} item item to get descendant tree from
   * @param {boolean} [options.ordered=false] whether the descendants should be ordered by path, guarantees to iterate on parent before children
   * @param {string[]} [options.types] filter out the items by type. If undefined or empty, all types are returned.
   * @returns {Item[]}
   */
  async getDescendants(
    item: FolderItem,
    options?: { ordered?: boolean; types?: string[]; selectOrder?: boolean },
  ): Promise<Item[]> {
    // TODO: LEVEL depth
    const { ordered = true, types, selectOrder } = options ?? {};

    const query = this.repository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.creator', 'creator')
      .where('item.path <@ :path', { path: item.path })
      .andWhere('item.id != :id', { id: item.id });

    if (types && types.length > 0) {
      query.andWhere('item.type IN (:...types)', { types });
    }

    // need order column to further sort in this function or afterwards
    if (ordered || selectOrder) {
      query.addSelect('item.order');
    }

    if (!ordered) {
      return query.getMany();
    }

    const descendants = await query.getMany();
    return sortChildrenForTreeWith(descendants, item);
  }

  async getManyDescendants(
    items: Item[],
    { withDeleted = false }: { withDeleted?: boolean } = {},
  ): Promise<Item[]> {
    // TODO: LEVEL depth
    if (items.length === 0) {
      return [];
    }
    const query = this.repository.createQueryBuilder('item');

    if (withDeleted) {
      query.withDeleted();
    }

    query.leftJoinAndSelect('item.creator', 'creator').where('item.id NOT IN(:...ids)', {
      ids: items.map(({ id }) => id),
    });

    query.andWhere(
      new Brackets((q) => {
        items.forEach((item) => {
          const key = `path_${item.path}`;
          q.orWhere(`item.path <@ :${key}`, { [key]: item.path });
        });
      }),
    );

    return query.getMany();
  }

  async getMany(ids: string[], args: { throwOnError?: boolean; withDeleted?: boolean } = {}) {
    if (!ids.length) {
      return { data: {}, errors: [] };
    }

    const { throwOnError = false } = args;
    const items = await this.repository.find({
      where: { id: In(ids) },
      relations: { creator: true },
      withDeleted: Boolean(args.withDeleted),
    });
    const result = mapById<Item>({
      keys: ids,
      findElement: (id) => items.find(({ id: thisId }) => thisId === id),
      buildError: (id) => new ItemNotFound(id),
    });

    if (throwOnError && result.errors.length) {
      throw result.errors[0];
    }

    return result;
  }

  async getNumberOfLevelsToFarthestChild(item: Item): Promise<number> {
    const farthestItem = await this.repository
      .createQueryBuilder('item')
      .addSelect(`nlevel(path) - nlevel('${item.path}')`)
      .where('item.path <@ :path', { path: item.path })
      .andWhere('id != :id', { id: item.id })
      .orderBy('nlevel(path)', 'DESC')
      .limit(1)
      .getOne();
    return farthestItem?.path?.split('.')?.length ?? 0;
  }

  /**
   * Return all the items where the creator is the given actor.
   * It even returns the item if the actor is the creator but without permissions on it !
   *
   * @param memberId The creator of the items.
   * @returns an array of items created by the actor.
   */
  async getForMemberExport(memberId: string): Promise<Item[]> {
    if (!memberId) {
      throw new MemberIdentifierNotFound();
    }

    return this.repository.find({
      select: schemaToSelectMapper(itemSchema),
      where: { creator: { id: memberId } },
      order: { updatedAt: 'DESC' },
      relations: {
        creator: true,
      },
    });
  }

  async getOwn(memberId: string): Promise<Item[]> {
    return this.repository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.creator', 'creator')
      .innerJoin('item_membership', 'im', 'im.item_path @> item.path')
      .where('creator.id = :id', { id: memberId })
      .andWhere('im.permission = :permission', { permission: PermissionLevel.Admin })
      .andWhere('nlevel(item.path) = 1')
      .orderBy('item.updatedAt', 'DESC')
      .getMany();
  }

  async move(item: Item, parentItem?: Item): Promise<Item> {
    if (parentItem) {
      // attaching tree to new parent item
      const { id: parentItemId, path: parentItemPath } = parentItem;

      // cannot move inside non folder item
      if (!isItemType(parentItem, ItemType.FOLDER)) {
        throw new ItemNotFolder(parentItemId);
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
      ? `'${parentItem.path}' || subpath(path, nlevel('${item.path}') - 1)`
      : `subpath(path, nlevel('${item.path}') - 1)`;

    // get new order value
    const order = await this.getNextOrderCount(parentItem?.path);

    await this.repository
      .createQueryBuilder('item')
      .update()
      .set({ path: () => pathSql, order })
      .where('item.path <@ :path', { path: item.path })
      .execute();

    // TODO: is there a better way?
    return this.get(item.id);
  }

  async patch(id: string, data: Partial<Item>): Promise<Item> {
    // TODO: extra + settings
    const item = await this.get(id);

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

    // TODO: check schema

    // update only if data is not empty
    if (Object.keys(data).length) {
      await this.repository.update(id, newData as QueryDeepPartialEntity<Item>);
    }

    // TODO: optimize
    return this.get(id);
  }

  async post(
    item: Partial<Item> & Pick<Item, 'name' | 'type'>,
    creator: Member,
    parentItem?: Item,
  ): Promise<Item> {
    const newItem = this.createOne({
      ...item,
      creator,
      parent: parentItem,
    });

    const createdItem = await this.repository.insert(newItem as QueryDeepPartialEntity<Item>);

    // TODO: better solution?
    // query builder returns creator as id and extra as string
    return this.get(createdItem.identifiers[0].id);
  }

  /////// -------- COPY
  async copy(
    item: Item,
    creator: Member,
    parentItem?: Item,
  ): Promise<{ copyRoot: Item; treeCopyMap: Map<string, { original: Item; copy: Item }> }> {
    // cannot copy inside non folder item
    if (parentItem && !isItemType(parentItem, ItemType.FOLDER)) {
      throw new ItemNotFolder(parentItem.id);
    }

    // copy (memberships from origin are not copied/kept)
    const treeItemsCopy = await this._copy(item, creator, parentItem);

    // return copy item + all descendants
    const newItems = [...treeItemsCopy.values()].map(({ copy }) => copy);
    const createdOp = await this.repository.insert(newItems as QueryDeepPartialEntity<Item>);

    const newItemRef = createdOp?.identifiers?.[0];
    if (!newItemRef) {
      throw new UnexpectedError({ operation: 'copy', itemId: item.id });
    }

    return {
      copyRoot: await this.get(newItemRef.id),
      treeCopyMap: treeItemsCopy,
    };
  }

  /**
   * Copy whole tree with new paths and same member as creator
   * @param original original item to be copied
   * @param parentItem Parent item whose path will 'prefix' all paths
   */
  private async _copy(original: Item, creator: Member, parentItem?: Item) {
    const old2New = new Map<string, { copy: Item; original: Item }>();

    // get next order value
    const order = await this.getNextOrderCount(parentItem?.path);

    // copy target parent
    const copiedItem = this.createOne({
      ...original,
      creator,
      parent: parentItem,
      name: this._addCopySuffix(original.name),
      order,
    });
    old2New.set(original.id, { copy: copiedItem, original: original });

    // handle descendants - change path
    if (isItemType(original, ItemType.FOLDER)) {
      await this.copyDescendants(original, creator, old2New);
    }

    return old2New;
  }

  /**
   * add in map generated copies for descendants of item, in given map
   * @param original
   * @param old2New mapping from original item to copied data, in-place updates
   */
  private async copyDescendants(
    original: FolderItem,
    creator: Member,
    old2New: Map<string, { copy: Item; original: Item }>,
  ): Promise<void> {
    const descendants = await this.getDescendants(original, {
      ordered: true,
      selectOrder: true,
    });
    for (let i = 0; i < descendants.length; i++) {
      const original = descendants[i];
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
   * Return a copy with a suffix of the string given in parameter.
   * The suffix respect the format " (0)". "0" is a succint positive number starting at 2.
   * If the string given in parameter already have a valid suffix, increase the number by 1.
   * If the copied name exceed the maximum characters allowed, the original name will be shorten,
   * the copied name will be equals to the maximum allowed.
   * @param name string to copy.
   * @returns a copy of the string given in parameter, with a suffix.
   */
  _addCopySuffix(name: string): string {
    let result = name;

    // If the name already have a copy suffix
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
  async getItemSumSize(memberId: string, itemType: FileItemType): Promise<number> {
    return parseInt(
      (
        await this.repository
          .createQueryBuilder('item')
          .select(`SUM(((item.extra::jsonb->'${itemType}')::jsonb->'size')::bigint)`, 'total')
          .where('item.creator.id = :memberId', { memberId })
          .andWhere('item.type = :type', { type: itemType })
          .getRawOne()
      ).total ?? 0,
    );
  }

  // to remove: unused
  async getAllPublishedItems(): Promise<Item[]> {
    const publishedRows = await this.repository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.creator', 'creator')
      .innerJoin('item_published', 'ip', 'ip.item_path = item.path')
      .getMany();

    return publishedRows;
  }

  /**
   * Return published items for given member
   * @param memberId
   * @returns published items for given member
   */
  async getPublishedItemsForMember(memberId: string): Promise<Item[]> {
    // get for membership write and admin -> createquerybuilder
    const result = await this.repository
      .createQueryBuilder('item')
      .innerJoin('item_published', 'pi', 'pi.item_path = item.path')
      .innerJoin('item_membership', 'im', 'im.item_path @> item.path')
      .innerJoinAndSelect('item.creator', 'member')
      .where('im.member_id = :memberId', { memberId })
      .andWhere('im.permission IN (:...permissions)', {
        permissions: [PermissionLevel.Admin, PermissionLevel.Write],
      })
      .getMany();

    return result;
  }

  async findAndCount(args: FindManyOptions<Item>) {
    return this.repository.findAndCount(args);
  }
  async softRemove(args: Item[]) {
    return this.repository.softRemove(args);
  }
  async recover(args: Item[]) {
    return this.repository.recover(args);
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
    parentPath?: Item['path'],
    previousItemId?: Item['id'],
  ): Promise<number | null> {
    // no order for root
    if (!parentPath) {
      return null;
    }

    const q = this.repository
      .createQueryBuilder('item')
      // default value: self order + "default order value" to increase of one the order
      .select(
        '(item.order + (lead(item.order, 1, item.order + (' +
          DEFAULT_ORDER +
          '*2)) OVER (ORDER BY item.order)))/2',
        'next',
      )
      .where('path <@ :path', { path: parentPath })
      .andWhere('path != :path', { path: parentPath });

    // by default take the biggest value
    let orderDirection: 'DESC' | 'ASC' = 'DESC';

    if (previousItemId) {
      // might not exist
      const previousItem = await this.repository
        .createQueryBuilder()
        .select('"order"')
        .where('id = :previousItemId', { previousItemId })
        // ensure it is a child in parent
        .andWhere('path ~ :ltree', { ltree: `${parentPath}.*{1}` })
        .getOne();

      // if needs to add in between, remove previous elements and order by next value to get the first one
      if (previousItem) {
        q.andWhere('item.order >= :previousOrder', { previousOrder: previousItem.order });
        // will take smallest value corresponding to given previous item id
        orderDirection = 'ASC';
      }
    }

    q.orderBy('next', orderDirection);

    const result = await q.limit(1).getRawOne<{ next: number }>();
    return result?.next ? +result.next : DEFAULT_ORDER;
  }

  /**
   * Return the first valid order value to use for inserting a new item at the beginning of the list, or whether there's no list.
   * This value is smaller than the smallest order that already exists.
   * If the parent item does not have children, it will return `undefined`
   * @param parentPath scope of the order
   * @returns {number|null} first valid order value, can be `null` for root
   */
  async getFirstOrderValue(parentPath?: Item['path']) {
    // no order for root
    if (!parentPath) {
      return null;
    }

    const q = this.repository
      .createQueryBuilder('item')
      .select('item.order')
      .where('path <@ :path AND path != :path', { path: parentPath })
      .orderBy('item.order')
      .limit(1);

    const result = await q.getOne();
    if (result && result.order) {
      return result.order / 2;
    }
    return DEFAULT_ORDER;
  }

  async reorder(item: Item, parentPath: Item['path'], previousItemId?: string) {
    // no defined previous item is set at beginning
    let order;
    if (!previousItemId) {
      // warning: by design reordering among one item will decrease this item order
      order = await this.getFirstOrderValue(parentPath);
    } else {
      order = await this.getNextOrderCount(parentPath, previousItemId);
    }
    await this.repository.update(item.id, { order });

    // TODO: optimize
    return this.get(item.id);
  }

  async rescaleOrder(parentItem: Item) {
    const children = await this.getChildren(parentItem, { ordered: true }, { withOrder: true });

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
      const values: Pick<Item, 'id' | 'order'>[] = children.map(({ id }, idx) => ({
        id,
        order: DEFAULT_ORDER * (idx + 1),
      }));

      // can update in disorder
      await Promise.all(
        values.map(async (i) => {
          return this.repository.update(i.id, i);
        }),
      );
    }
  }
}
