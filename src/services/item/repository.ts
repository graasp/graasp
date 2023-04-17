import { In } from 'typeorm';
import { v4 } from 'uuid';

import {
  FolderItemType,
  ItemSettings,
  ItemType,
  MAX_TREE_LEVELS,
  ResultOf,
  UUID,
} from '@graasp/sdk';

import { AppDataSource } from '../../plugins/datasource';
import { DEFAULT_ITEM_SETTINGS } from '../../utils/config';
import {
  HierarchyTooDeep,
  InvalidMoveTarget,
  ItemNotFound,
  TooManyDescendants,
} from '../../utils/errors';
import { Member } from '../member/entities/member';
import { mapById } from '../utils';
import { Item, ItemExtra } from './entities/Item';
import {
  _fixChildrenOrder,
  dashToUnderscore,
  itemDepth,
  parentPath,
  pathToId,
  sortChildrenWith,
} from './utils';

export const ItemRepository = AppDataSource.getRepository(Item).extend({
  checkHierarchyDepth(item: Item, additionalNbLevel = 1) {
    // check if hierarchy it too deep
    // adds nb of items to be created
    if (itemDepth(item) + additionalNbLevel > MAX_TREE_LEVELS) {
      throw new HierarchyTooDeep();
    }
  },

  async checkNumberOfDescendants(item: Item, maximum: number) {
    // check how "big the tree is" below the item
    const numberOfDescendants = await this.getNumberOfDescendants(item.path);
    if (numberOfDescendants > maximum) {
      throw new TooManyDescendants(item.id);
    }
  },

  /**
   * build item based on propeties
   * does not save it
   */
  createOne(args: {
    name: string;
    description: string;
    type: ItemType;
    extra: ItemExtra;
    settings: ItemSettings;
    creator: Member;
    parent?: Item;
  }): Item {
    const {
      name,
      description = null,
      parent,
      type = ItemType.FOLDER,
      extra,
      settings = DEFAULT_ITEM_SETTINGS,
      creator,
    } = args;
    // TODO: extra
    // folder's extra can be empty
    const parsedExtra = extra ? JSON.parse(JSON.stringify(extra)) : ({} as ItemExtra);
    const id = v4();

    const item = this.create({
      id,
      name,
      description,
      type,
      extra: parsedExtra,
      settings,
      creator,
    });
    item.path = parent ? `${parent.path}.${dashToUnderscore(id)}` : dashToUnderscore(id);

    return item;
  },

  async deleteMany(ids: string[]): Promise<UUID[]> {
    await this.delete(ids);
    return ids;
  },

  async get(id: string, options = { withDeleted: false }): Promise<Item> {
    // additional check that id is not null
    // o/w empty parameter to findOneBy return the first entry
    // TODO: improve

    const item = await this.findOne({
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
  },

  /**
   * options.bypass {boolean} if true, return parents even if the user does not have membership
   * */
  async getAncestors(item: Item): Promise<Item[]> {
    return this.createQueryBuilder('item')
    .leftJoinAndSelect('item.creator', 'creator')
      .where('item.path @> :path', { path: item.path })
      .andWhere('item.id != :id', { id: item.id })
      .getMany();
  },

  async getChildren(parent: Item, ordered?: boolean): Promise<Item[]> {
    if (parent.type !== ItemType.FOLDER) {
      // TODO
      throw new Error('Item is not a folder');
    }

    // CHECK SQL
    const children = await this.createQueryBuilder('item')
      .leftJoinAndSelect('item.creator', 'creator')
      .where('path ~ :path', {path: `${parent.path}.*{1}`})
      .orderBy('item.createdAt', 'ASC')
      .getMany();

    if (ordered) {
      const { extra: { folder } = {} } = parent as FolderItemType;
      const childrenOrder = folder?.childrenOrder ?? [];
      if (childrenOrder.length) {
        const compareFn = sortChildrenWith(childrenOrder);
        children.sort(compareFn);
      }
    }
    return children;
  },

  async getDescendants(item: Item): Promise<Item[]> {
    // TODO: LEVEL depth
    return this.createQueryBuilder('item')
      .where('item.path <@ :path', { path: item.path })
      .andWhere('id != :id', { id: item.id })
      .getMany();
  },

  async getManyDescendants(items: Item[]): Promise<Item[]> {
    // TODO: LEVEL depth
    const query = this.createQueryBuilder('item').where('id NOT IN(:...ids)', {
      ids: items.map(({ id }) => id),
    });

    items.forEach((item) => {
      const key = `path_${item.path}`;
      query.andWhere(`item.path <@ :${key}`, { [key]: item.path });
    });

    return query.getMany();
  },

  async getMany(
    ids: string[],
    args: { throwOnError?: boolean; withDeleted?: boolean } = {},
  ): Promise<ResultOf<Item>> {
    const { throwOnError = false } = args;
    const items = await this.find({
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
  },

  async getNumberOfDescendants(path: string): Promise<number> {
    const result = await this.createQueryBuilder('item')
      .where('item.path @> :path', { path })
      .addSelect('COUNT(*)', 'count')
      .groupBy('item.id')
      .getRawOne();

    return result?.count;
  },

  // TODO: check result value
  async getNumberOfLevelsToFarthestChild(item: Item): Promise<number> {
    return this.createQueryBuilder('item')
      .addSelect(`nlevel(path) - nlevel('${item.path}')`)
      .where('item.path <@ :path', { path: item.path })
      .andWhere('id != :id', { id: item.id })
      .orderBy('nlevel(path)', 'DESC')
      .limit(1)
      .getRawOne();
  },

  async getOwn(memberId: string): Promise<Item[]> {
    return this.createQueryBuilder('item')
      .leftJoinAndSelect('item.creator', 'creator')
      .where('creator.id = :id', { id: memberId })
      .andWhere('nlevel(item.path) = 1')
      .orderBy('item.updatedAt', 'DESC')
      .getMany();
  },

  async move(item: Item, parentItem?: Item): Promise<void> {
    if (parentItem) {
      // attaching tree to new parent item
      const { id: parentItemId, path: parentItemPath } = parentItem;
      // fail if
      if (
        parentItemPath.startsWith(item.path) || // moving into itself or "below" itself
        parentPath(item) === parentItemPath // moving to the same parent ("not moving")
      ) {
        throw new InvalidMoveTarget(parentItemId);
      }

      // TODO: should this info go into 'message'? (it's the only exception to the rule)
    } else if (!parentPath(item)) {
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

    return this.createQueryBuilder('item')
      .update()
      .set({ path: () => pathSql })
      .where('item.path <@ :path', {path:item.path})
      .execute();
  },

  async patch(id: string, data: Partial<Item>): Promise<Item> {
    // TODO: extra + settings
    const item = await this.get(id);

    const { extra: extraChanges, settings: settingsChanges } = data;
    this.targetId = item.id;

    // only allow for item type specific changes in extra
    const extraForType = extraChanges?.[item.type];
    if (data.extra && extraForType) {
      if (Object.keys(extraForType).length === 1) {
        data.extra[item.type] = Object.assign({}, item.extra[item.type], extraForType);
      } else {
        delete data.extra;
      }
    }

    if (settingsChanges) {
      if (Object.keys(settingsChanges).length === 1) {
        data.settings = Object.assign({}, item.settings, settingsChanges);
      } else {
        delete data.settings;
      }
    }

    // TODO: check schema

    // update only if data is not empty
    if (Object.keys(data).length) {
      await this.update(id, data);
    }

    // TODO: optimize
    return this.get(id);
  },

  async post(item: Partial<Item>, creator: Member, parentItem?: Item): Promise<Item> {
    const newItem = this.createOne({ ...item, creator, parent: parentItem });

    const createdItem = await this.insert(newItem);

    // TODO: better solution?
    // query builder returns creator as id and extra as string
    return this.get(createdItem.identifiers[0].id);
  },

  /////// -------- COPY
  async copy(item: Item, creator: Member, parentItem?: Item): Promise<Item> {
    const descendants = await this.getDescendants(item);

    // copy (memberships from origin are not copied/kept)
    // get the whole tree
    const treeItems = [item].concat(descendants);
    const treeItemsCopy = this._copy(treeItems, creator, parentItem);

    _fixChildrenOrder(treeItemsCopy);
    // return copy item + all descendants
    await this.insert([...treeItemsCopy.values()].map(({ copy }) => copy));

    // TODO: copy item + all descendants
    return item;
  },

  // UTILS

  /**
   * Copy whole tree with new paths and same member as creator
   * @param tree Item and all descendants to copy
   * @param parentItem Parent item whose path will 'prefix' all paths
   */
  _copy(tree: Item[], creator: Member, parentItem?: Item) {
    const old2New = new Map<string, { copy: Item; original: Item }>();

    for (let i = 0; i < tree.length; i++) {
      const original = tree[i];
      const { name, description, type, path, extra, settings } = original;
      const pathSplit = path.split('.');
      const oldPath = pathSplit.pop();
      // this shouldn't happen
      if (!oldPath) {
        throw new Error('Path is not defined');
      }
      const oldId_ = pathToId(oldPath);
      let copiedItem: Item;

      if (i === 0) {
        copiedItem = this.createOne({
          name,
          description,
          type,
          extra,
          settings,
          creator,
          parent: parentItem,
        });
      } else {
        const oldParentPath = pathSplit.pop();
        // this shouldn't happen
        if (!oldParentPath) {
          throw new Error('Path is not defined');
        }
        const oldParentId_ = pathToId(oldParentPath);
        const oldParentObject = old2New.get(oldParentId_);
        // this shouldn't happen
        if (!oldParentObject) {
          throw new Error('Old parent is not defined');
        }

        copiedItem = this.createOne({
          name,
          description,
          type,
          extra,
          settings,
          creator,
          parent: oldParentObject.copy,
        });
      }

      old2New.set(oldId_, { copy: copiedItem, original });
    }

    return old2New;
  },
});
