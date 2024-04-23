import { Brackets, EntityManager, FindManyOptions, In, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { v4 } from 'uuid';

import {
  FileItemType,
  ItemType,
  MAX_TREE_LEVELS,
  PermissionLevel,
  buildPathFromIds,
  getChildFromPath,
  getParentFromPath,
} from '@graasp/sdk';
import { ItemSettings } from '@graasp/sdk/types/item/itemSettings';

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
import { itemSchema } from '../member/plugins/data/schemas/schemas';
import { schemaToSelectMapper } from '../member/plugins/data/utils/selection.utils';
import { mapById } from '../utils';
import { FolderItem, Item, ItemExtraUnion, isItemType } from './entities/Item';
import { ItemChildrenParams } from './types';
import { _fixChildrenOrder, sortChildrenForTreeWith, sortChildrenWith } from './utils';

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
  }) {
    const {
      name,
      displayName,
      description = null,
      parent,
      type = ItemType.FOLDER,
      extra,
      settings = {},
      lang,
      creator,
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
      displayName: displayName ?? name,
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

  async getChildren(parent: Item, params?: ItemChildrenParams): Promise<Item[]> {
    if (!isItemType(parent, ItemType.FOLDER)) {
      throw new ItemNotFolder(parent);
    }

    // CHECK SQL
    const query = await this.repository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.creator', 'creator')
      .where('path ~ :path', { path: `${parent.path}.*{1}` });

    if (params?.types) {
      const types = params.types;
      query.andWhere('item.type IN (:...types)', { types });
    }

    const children = await query.orderBy('item.createdAt', 'ASC').getMany();

    if (params?.ordered) {
      const { extra: { folder } = {} } = parent;
      const childrenOrder = folder?.childrenOrder ?? [];
      const compareFn = sortChildrenWith(childrenOrder);
      children.sort(compareFn);
    }
    return children;
  }

  /**
   * Return tree below item
   * @param {Item} item item to get descendant tree from
   * @param {boolean} [options.ordered=false] whether the descendants should be ordered by path, guarantees to iterate on parent before children
   * @returns {Item[]}
   */
  async getDescendants(item: FolderItem, options?: { ordered: boolean }): Promise<Item[]> {
    // TODO: LEVEL depth
    const { ordered = true } = options ?? {};

    const query = this.repository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.creator', 'creator')
      .where('item.path <@ :path', { path: item.path })
      .andWhere('item.id != :id', { id: item.id });

    if (!ordered) {
      return query.getMany();
    }

    query.orderBy('item.path', 'ASC');
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

    await this.repository
      .createQueryBuilder('item')
      .update()
      .set({ path: () => pathSql })
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

    const descendants = await this.getDescendants(item as FolderItem, { ordered: true });
    // copy (memberships from origin are not copied/kept)
    const treeItemsCopy = this._copy(item, descendants, creator, parentItem);

    _fixChildrenOrder(treeItemsCopy);
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
   * @param originalParent original item to be copied
   * @param descendants all descendants from  originalParent. This array is supposed to be sorted beforehand!
   * @param tree Item and all descendants to copy
   * @param parentItem Parent item whose path will 'prefix' all paths
   */
  private _copy(originalParent: Item, descendants: Item[], creator: Member, parentItem?: Item) {
    const old2New = new Map<string, { copy: Item; original: Item }>();

    // copy target parent
    const copiedItem = this.createOne({
      ...originalParent,
      creator,
      parent: parentItem,
    });
    old2New.set(originalParent.id, { copy: copiedItem, original: originalParent });

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

    return old2New;
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

  async getAllPublishedItems(): Promise<Item[]> {
    const publishedRows = await this.repository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.creator', 'creator')
      .innerJoin('item_published', 'ip', 'ip.item_path = item.path')
      .getMany();

    return publishedRows;
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
}
