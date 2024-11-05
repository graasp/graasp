import { Brackets, EntityManager } from 'typeorm';

import { ItemVisibilityType, ResultOf, getChildFromPath } from '@graasp/sdk';

import { AbstractRepository } from '../../../../repositories/AbstractRepository';
import { EntryNotFoundAfterInsertException } from '../../../../repositories/errors';
import { AncestorOf } from '../../../../utils/typeorm/treeOperators';
import { Member } from '../../../member/entities/member';
import { mapById } from '../../../utils';
import { Item } from '../../entities/Item';
import { ItemVisibility } from './ItemVisibility';
import {
  CannotModifyParentVisibility,
  ConflictingVisibilitiesInTheHierarchy,
  InvalidUseOfItemVisibilityRepository,
  ItemVisibilityNotFound,
} from './errors';

/**
 * Database's first layer of abstraction for Item Tags and (exceptionally) for Tags (at the bottom)
 */
export class ItemVisibilityRepository extends AbstractRepository<ItemVisibility> {
  constructor(manager?: EntityManager) {
    super(ItemVisibility, manager);
  }

  async getType(itemPath: Item['path'], tagType: ItemVisibilityType, { shouldThrow = false } = {}) {
    const hasTag = await this.repository
      .createQueryBuilder('itemVisibility')
      .leftJoinAndSelect('itemVisibility.item', 'item')
      .where('item.path @> :path', { path: itemPath })
      .andWhere('itemVisibility.type = :type', { type: tagType })
      .getOne();

    if (shouldThrow && !hasTag) {
      throw new ItemVisibilityNotFound(tagType);
    }

    return hasTag;
  }

  /**
   * return whether item has item visibility types
   * @param item
   * @param visibilityTypes
   * @returns map type => whether item has this visibility type
   */
  async hasMany(item: Item, visibilityTypes: ItemVisibilityType[]) {
    const hasTags = await this.repository
      .createQueryBuilder('itemVisibility')
      .leftJoinAndSelect('itemVisibility.item', 'item')
      .where('itemVisibility.item @> :path', { path: item.path })
      .andWhere('itemVisibility.type IN (:...types)', { types: visibilityTypes })
      .getMany();

    return mapById({
      keys: visibilityTypes,
      findElement: (type) => Boolean(hasTags.find(({ type: thisType }) => type === thisType)),
    });
  }

  private async getManyTagsForTypes(
    items: Item[],
    visibilityTypes: ItemVisibilityType[],
  ): Promise<ItemVisibility[]> {
    // we expect to query visibilities for defined items, if the items array is empty we will return
    if (!items.length) {
      return [];
    }

    const query = this.repository
      .createQueryBuilder('itemVisibility')
      .leftJoinAndSelect('itemVisibility.item', 'item');

    query.where(
      new Brackets((qb) => {
        items.forEach(({ path }, idx) => {
          const key = `${path}_${idx}`;
          qb.orWhere(`item.path @> :${key}`, { [key]: path });
        });
      }),
    );

    const hasTags: ItemVisibility[] = await query
      .andWhere('itemVisibility.type IN (:...types)', { types: visibilityTypes })
      .getMany();
    return hasTags;
  }

  async getManyForMany(
    items: Item[],
    visibilityTypes: ItemVisibilityType[],
  ): Promise<ResultOf<ItemVisibility[]>> {
    const visibilities = await this.getManyTagsForTypes(items, visibilityTypes);

    const mapByPath = mapById({
      keys: items.map(({ path }) => path),
      findElement: (path) =>
        visibilities.filter((itemVisibility) => path.includes(itemVisibility.item.path)),
    });

    // use id as key
    const idToItemVisibilities = Object.fromEntries(
      Object.entries(mapByPath.data).map(([key, value]) => [getChildFromPath(key), value]),
    );

    return { data: idToItemVisibilities, errors: mapByPath.errors };
  }

  /**
   * return item visibility with given for all items below given item, including item's
   * @param item item use to refer to its descendants
   * @param visibilityTypes visibility types to retrieve
   * @returns visibility array
   */
  async getManyBelowAndSelf(
    item: Item,
    visibilityTypes: ItemVisibilityType[],
  ): Promise<ItemVisibility[]> {
    const query = this.repository
      .createQueryBuilder('itemVisibility')
      .leftJoinAndSelect('itemVisibility.item', 'item');

    query.where(`item.path <@ :path`, { path: item.path });

    const visibilities: ItemVisibility[] = await query
      .andWhere('itemVisibility.type IN (:...types)', { types: visibilityTypes })
      .getMany();

    return visibilities;
  }

  async hasForMany(items: Item[], tagType: ItemVisibilityType): Promise<ResultOf<boolean>> {
    const query = this.repository
      .createQueryBuilder('itemVisibility')
      .leftJoinAndSelect('itemVisibility.item', 'item');

    query.where(
      new Brackets((qb) => {
        items.forEach(({ path }, idx) => {
          const key = `${path}_${idx}`;
          qb.orWhere(`item.path @> :${key}`, { [key]: path });
        });
      }),
    );

    const haveTag = await query
      .andWhere('itemVisibility.type = :type', { type: tagType })
      .getMany();

    const mapByPath = mapById({
      keys: items.map(({ path }) => path),
      findElement: (path) =>
        Boolean(haveTag.find((itemVisibility) => path.includes(itemVisibility.item.path))),
    });

    // use id as key
    const idToItemVisibilities = Object.fromEntries(
      Object.entries(mapByPath.data).map(([key, value]) => [getChildFromPath(key), value]),
    );

    return { data: idToItemVisibilities, errors: mapByPath.errors };
  }

  /**
   * Save an item visibility for item with given type
   * Throws if a visibility already exists for parent
   * @param  {Member} creator
   * @param  {Item} item
   * @param  {ItemVisibilityType} type
   */
  async post(creator: Member, item: Item, type: ItemVisibilityType) {
    const existingVisibility = await this.getType(item.path, type);
    if (existingVisibility) {
      throw new ConflictingVisibilitiesInTheHierarchy({ item, type });
    }

    const entry = { item: { path: item.path }, type, creator };
    const created = await this.repository.insert(entry);
    const result = await this.repository.findOneBy({ id: created.identifiers[0].id });
    if (!result) {
      throw new EntryNotFoundAfterInsertException(ItemVisibility);
    }
    return result;
  }

  /**
   * Delete one visibility item given the item and type
   * @param  {Item} item
   * @param  {ItemVisibilityType} type
   */
  async deleteOne(item: Item, type: ItemVisibilityType) {
    // delete from parent only
    await this.isNotInherited(item, type);

    // delete item visibility
    // we delete descendants visibilities, they happen on copy, move, or if you had on ancestor
    // but does not change the behavior
    // cannot use leftJoinAndSelect for delete, so we select first
    const itemVisibilitys = await this.repository
      .createQueryBuilder('itemVisibility')
      .leftJoinAndSelect('itemVisibility.item', 'item')
      .where('item.path <@ :path', { path: item.path })
      .andWhere('itemVisibility.type = :type', { type })
      .getMany();

    if (!itemVisibilitys || !itemVisibilitys.length) {
      throw new ItemVisibilityNotFound({ item, type });
    }

    const ids = itemVisibilitys.map(({ id }) => id);
    await this.repository.delete(ids);
  }

  async isNotInherited(item: Item, type: ItemVisibilityType, { shouldThrow = true } = {}) {
    const entry = await this.getType(item.path, type);
    if (entry && entry.item.path !== item.path && shouldThrow) {
      throw new CannotModifyParentVisibility(entry);
    }
  }

  /**
   * Get all visibilities for one item
   * @param  {Item} item
   */
  async getByItemPath(itemPath: string) {
    return this.repository.find({
      where: { item: { path: AncestorOf(itemPath) } },
      relations: { item: true },
    });
  }

  /**
   * Get all visibilities for given items
   * @throws when item array is empty, as this is considered an invalid use of the function
   * @param  {Item[]} items
   */
  async getForManyItems(items: Item[], { withDeleted = false }: { withDeleted?: boolean } = {}) {
    // should not query when items array is empty
    if (!items.length) {
      throw new InvalidUseOfItemVisibilityRepository();
    }

    const query = this.repository
      .createQueryBuilder('itemVisibility')
      .leftJoinAndSelect('itemVisibility.item', 'item');

    items.forEach(({ path }, idx) => {
      if (idx === 0) {
        query.where(`item.path @> :path_${path}`, { [`path_${path}`]: path });
      } else {
        query.orWhere(`item.path @> :path_${path}`, { [`path_${path}`]: path });
      }
    });

    if (withDeleted) {
      query.withDeleted();
    }

    const visibilities = await query.getMany();

    const mapByPath = mapById({
      keys: items.map(({ path }) => path),
      findElement: (path) =>
        visibilities.filter((itemVisibility) => path.includes(itemVisibility.item.path)),
    });
    // use id as key
    const idToItemVisibilities = Object.fromEntries(
      Object.entries(mapByPath.data).map(([key, value]) => [getChildFromPath(key), value]),
    );

    return { data: idToItemVisibilities, errors: mapByPath.errors };
  }

  /**
   * Copy all item visibilities from original to copy
   * @param  {Member} creator
   * @param  {Item} original
   * @param  {Item} copy
   * @param  {object} excludeTypes
   */
  async copyAll(creator: Member, original: Item, copy: Item, excludeTypes?: ItemVisibilityType[]) {
    // delete from parent only
    const itemVisibilitys = await this.getByItemPath(original.path);
    if (itemVisibilitys) {
      await this.repository.insert(
        itemVisibilitys
          .filter((visibility) => !excludeTypes?.includes(visibility.type))
          .map(({ type }) => ({ item: { path: copy.path }, type, creator })),
      );
    }
  }
}
