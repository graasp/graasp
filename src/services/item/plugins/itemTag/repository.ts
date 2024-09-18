import { Brackets, EntityManager } from 'typeorm';

import { ItemTagType, ResultOf, getChildFromPath } from '@graasp/sdk';

import { AbstractRepository } from '../../../../repositories/AbstractRepository';
import { AncestorOf } from '../../../../utils/typeorm/treeOperators';
import { Member } from '../../../member/entities/member';
import { mapById } from '../../../utils';
import { Item } from '../../entities/Item';
import { ItemTag } from './ItemTag';
import {
  CannotModifyParentTag,
  ConflictingTagsInTheHierarchy,
  InvalidUseOfItemTagsRepository,
  ItemTagNotFound,
} from './errors';

/**
 * Database's first layer of abstraction for Item Tags and (exceptionally) for Tags (at the bottom)
 */
export class ItemTagRepository extends AbstractRepository<ItemTag> {
  constructor(manager?: EntityManager) {
    super(ItemTag, manager);
  }

  async getType(itemPath: Item['path'], tagType: ItemTagType, { shouldThrow = false } = {}) {
    const hasTag = await this.repository
      .createQueryBuilder('itemTag')
      .leftJoinAndSelect('itemTag.item', 'item')
      .where('item.path @> :path', { path: itemPath })
      .andWhere('itemTag.type = :type', { type: tagType })
      .getOne();

    if (shouldThrow && !hasTag) {
      throw new ItemTagNotFound(tagType);
    }

    return hasTag;
  }

  /**
   * return whether item has item tag types
   * @param item
   * @param tagTypes
   * @returns map type => whether item has this tag type
   */
  async hasMany(item: Item, tagTypes: ItemTagType[]) {
    const hasTags = await this.repository
      .createQueryBuilder('itemTag')
      .leftJoinAndSelect('itemTag.item', 'item')
      .where('itemTag.item @> :path', { path: item.path })
      .andWhere('itemTag.type IN (:...types)', { types: tagTypes })
      .getMany();

    return mapById({
      keys: tagTypes,
      findElement: (type) => Boolean(hasTags.find(({ type: thisType }) => type === thisType)),
    });
  }

  private async getManyTagsForTypes(items: Item[], tagTypes: ItemTagType[]): Promise<ItemTag[]> {
    // we expect to query tags for defined items, if the items array is empty we will return
    if (!items.length) {
      return [];
    }

    const query = this.repository
      .createQueryBuilder('itemTag')
      .leftJoinAndSelect('itemTag.item', 'item');

    query.where(
      new Brackets((qb) => {
        items.forEach(({ path }, idx) => {
          const key = `${path}_${idx}`;
          qb.orWhere(`item.path @> :${key}`, { [key]: path });
        });
      }),
    );

    const hasTags: ItemTag[] = await query
      .andWhere('itemTag.type IN (:...types)', { types: tagTypes })
      .getMany();
    return hasTags;
  }

  async hasManyForMany(items: Item[], tagTypes: ItemTagType[]): Promise<ResultOf<ItemTagType[]>> {
    const tags = await this.getManyTagsForTypes(items, tagTypes);

    const mapByPath = mapById({
      keys: items.map(({ path }) => path),
      findElement: (path) =>
        tags.filter((itemTag) => path.includes(itemTag.item.path)).map((t) => t.type),
    });

    // use id as key
    const idToItemTagTypes = Object.fromEntries(
      Object.entries(mapByPath.data).map(([key, value]) => [getChildFromPath(key), value]),
    );

    return { data: idToItemTagTypes, errors: mapByPath.errors };
  }

  async getManyForMany(items: Item[], tagTypes: ItemTagType[]): Promise<ResultOf<ItemTag[]>> {
    const tags = await this.getManyTagsForTypes(items, tagTypes);

    const mapByPath = mapById({
      keys: items.map(({ path }) => path),
      findElement: (path) => tags.filter((itemTag) => path.includes(itemTag.item.path)),
    });

    // use id as key
    const idToItemTags = Object.fromEntries(
      Object.entries(mapByPath.data).map(([key, value]) => [getChildFromPath(key), value]),
    );

    return { data: idToItemTags, errors: mapByPath.errors };
  }

  /**
   * return item tag with given for all items below given item, including item's
   * @param item item use to refer to its descendants
   * @param tagTypes tag types to retrieve
   * @returns tags array
   */
  async getManyBelowAndSelf(item: Item, tagTypes: ItemTagType[]): Promise<ItemTag[]> {
    const query = this.repository
      .createQueryBuilder('itemTag')
      .leftJoinAndSelect('itemTag.item', 'item');

    query.where(`item.path <@ :path`, { path: item.path });

    const tags: ItemTag[] = await query
      .andWhere('itemTag.type IN (:...types)', { types: tagTypes })
      .getMany();

    return tags;
  }

  async hasForMany(items: Item[], tagType: ItemTagType): Promise<ResultOf<boolean>> {
    const query = this.repository
      .createQueryBuilder('itemTag')
      .leftJoinAndSelect('itemTag.item', 'item');

    query.where(
      new Brackets((qb) => {
        items.forEach(({ path }, idx) => {
          const key = `${path}_${idx}`;
          qb.orWhere(`item.path @> :${key}`, { [key]: path });
        });
      }),
    );

    const haveTag = await query.andWhere('itemTag.type = :type', { type: tagType }).getMany();

    const mapByPath = mapById({
      keys: items.map(({ path }) => path),
      findElement: (path) => Boolean(haveTag.find((itemTag) => path.includes(itemTag.item.path))),
    });

    // use id as key
    const idToItemTags = Object.fromEntries(
      Object.entries(mapByPath.data).map(([key, value]) => [getChildFromPath(key), value]),
    );

    return { data: idToItemTags, errors: mapByPath.errors };
  }

  /**
   * Save an item tag for item with given type
   * Throws if a  tag already exists for parent
   * @param  {Member} creator
   * @param  {Item} item
   * @param  {ItemTagType} type
   */
  async post(creator: Member, item: Item, type: ItemTagType) {
    const existingTag = await this.getType(item.path, type);
    if (existingTag) {
      throw new ConflictingTagsInTheHierarchy({ item, type });
    }

    const entry = { item: { path: item.path }, type, creator };
    const created = await this.repository.insert(entry);
    return this.repository.findOneBy({ id: created.identifiers[0].id });
  }

  /**
   * Delete one tag item given the item and type
   * @param  {Item} item
   * @param  {ItemTagType} type
   */
  async deleteOne(item: Item, type: ItemTagType) {
    // delete from parent only
    await this.isNotInherited(item, type);

    // delete item tag
    // we delete descendants tags, they happen on copy, move, or if you had on ancestor
    // but does not change the behavior
    // cannot use leftJoinAndSelect for delete, so we select first
    const itemTags = await this.repository
      .createQueryBuilder('itemTag')
      .leftJoinAndSelect('itemTag.item', 'item')
      .where('item.path <@ :path', { path: item.path })
      .andWhere('itemTag.type = :type', { type })
      .getMany();

    if (!itemTags || !itemTags.length) {
      throw new ItemTagNotFound({ item, type });
    }

    const ids = itemTags.map(({ id }) => id);
    await this.repository.delete(ids);
  }

  async isNotInherited(item: Item, type: ItemTagType, { shouldThrow = true } = {}) {
    const entry = await this.getType(item.path, type);
    if (entry && entry.item.path !== item.path && shouldThrow) {
      throw new CannotModifyParentTag(entry);
    }
  }

  // /**
  //  * Get all items with given tag type
  //  * @param  {ItemTagType} tagType
  //  */
  // async getItemsBy(tagType: ItemTagType) {
  //   const itemTag = await this.repository.find({ where: { type: tagType }, relations: { item: true } });
  //   return itemTag.map(({ item }) => item);
  // },

  /**
   * Get all tags for one item
   * @param  {Item} item
   */
  async getByItemPath(itemPath: string) {
    return this.repository.find({
      where: { item: { path: AncestorOf(itemPath) } },
      relations: { item: true },
    });
  }

  /**
   * Get all tags for given items
   * @throws when item array is empty, as this is considered an invalid use of the function
   * @param  {Item[]} items
   */
  async getForManyItems(items: Item[], { withDeleted = false }: { withDeleted?: boolean } = {}) {
    // should not query when items array is empty
    if (!items.length) {
      throw new InvalidUseOfItemTagsRepository();
    }

    const query = this.repository
      .createQueryBuilder('itemTag')
      .leftJoinAndSelect('itemTag.item', 'item');

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

    const tags = await query.getMany();

    const mapByPath = mapById({
      keys: items.map(({ path }) => path),
      findElement: (path) => tags.filter((itemTag) => path.includes(itemTag.item.path)),
    });
    // use id as key
    const idToItemTags = Object.fromEntries(
      Object.entries(mapByPath.data).map(([key, value]) => [getChildFromPath(key), value]),
    );

    return { data: idToItemTags, errors: mapByPath.errors };
  }

  /**
   * Copy all item tags from original to copy
   * @param  {Member} creator
   * @param  {Item} original
   * @param  {Item} copy
   * @param  {object} excludeTypes
   */
  async copyAll(creator: Member, original: Item, copy: Item, excludeTypes?: ItemTagType[]) {
    // delete from parent only
    const itemTags = await this.getByItemPath(original.path);
    if (itemTags) {
      await this.repository.insert(
        itemTags
          .filter((tag) => !excludeTypes?.includes(tag.type))
          .map(({ type }) => ({ item: { path: copy.path }, type, creator })),
      );
    }
  }
}
