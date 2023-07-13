import { Brackets } from 'typeorm';

import { ItemTagType, ResultOf } from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource';
import { Member } from '../../../member/entities/member';
import { mapById } from '../../../utils';
import { Item } from '../../entities/Item';
import { pathToId } from '../../utils';
import { ItemTag } from './ItemTag';
import { CannotModifyParentTag, ConflictingTagsInTheHierarchy, ItemTagNotFound } from './errors';

/**
 * Database's first layer of abstraction for Item Tags and (exceptionally) for Tags (at the bottom)
 */
export const ItemTagRepository = AppDataSource.getRepository(ItemTag).extend({
  async getType(item: Item, tagType: ItemTagType, { shouldThrow = false } = {}) {
    const hasTag = await this.createQueryBuilder('itemTag')
      .leftJoinAndSelect('itemTag.item', 'item')
      .where('item.path @> :path', { path: item.path })
      .andWhere('itemTag.type = :type', { type: tagType })
      .getOne();

    if (shouldThrow && !hasTag) {
      // TODO
      throw new ItemTagNotFound(tagType);
    }

    return hasTag;
  },

  /**
   * return whether item has item tag types
   * @param item
   * @param tagTypes
   * @returns map type => whether item has this tag type
   */
  async hasMany(item: Item, tagTypes: ItemTagType[]) {
    const hasTags = await this.createQueryBuilder('itemTag')
      .leftJoinAndSelect('itemTag.item', 'item')
      .where('itemTag.item @> :path', { path: item.path })
      .andWhere('itemTag.type IN (:...types)', { types: tagTypes })
      .getMany();

    return mapById({
      keys: tagTypes,
      findElement: (type) => Boolean(hasTags.find(({ type: thisType }) => type === thisType)),
    });
  },

  async hasManyForMany(items: Item[], tagTypes: ItemTagType[]) {
    const query = this.createQueryBuilder('itemTag').leftJoinAndSelect('itemTag.item', 'item');

    query.where(
      new Brackets((qb) => {
        items.forEach(({ path }, idx) => {
          const key = `${path}_${idx}`;
          qb.orWhere(`item.path @> :${key}`, { [key]: path });
        });
      }),
    );

    const hasTags = await query
      .andWhere('itemTag.type IN (:...types)', { types: tagTypes })
      .getOne();

    return mapById({
      keys: tagTypes,
      findElement: (type) => Boolean(hasTags.find(({ type: thisType }) => type === thisType)),
    });
  },

  async hasForMany(items: Item[], tagType: ItemTagType): Promise<ResultOf<boolean>> {
    const query = this.createQueryBuilder('itemTag').leftJoinAndSelect('itemTag.item', 'item');
    console.log(`HOTFIX: itemTagsHasForMany ${JSON.stringify(items)}`);

    query.where(
      new Brackets((qb) => {
        items.forEach(({ path }, idx) => {
          console.log(`HOTFIX: forEach ${JSON.stringify(path)} on ${idx}`);
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
      Object.entries(mapByPath.data).map(([key, value]) => [pathToId(key), value]),
    );

    return { data: idToItemTags, errors: mapByPath.errors };
  },
  /**
   * Save an item tag for item with given type
   * Throws if a  tag already exists for parent
   * @param  {Member} creator
   * @param  {Item} item
   * @param  {ItemTagType} type
   */
  async post(creator: Member, item: Item, type: ItemTagType) {
    const existingTag = await this.getType(item, type);
    if (existingTag) {
      throw new ConflictingTagsInTheHierarchy({ item, type });
    }

    const entry = this.create({ item, type, creator });
    await this.insert(entry);
    return entry;
  },
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
    const itemTags = await this.createQueryBuilder('itemTag')
      .leftJoinAndSelect('itemTag.item', 'item')
      .where('item.path <@ :path', { path: item.path })
      .andWhere('itemTag.type = :type', { type })
      .getMany();

    if (!itemTags || !itemTags.length) {
      throw new ItemTagNotFound({ item, type });
    }

    const ids = itemTags.map(({ id }) => id);
    await this.delete(ids);
  },

  async isNotInherited(item: Item, type: ItemTagType, { shouldThrow = true } = {}) {
    const entry = await this.getType(item, type);
    if (entry && entry.item.path !== item.path && shouldThrow) {
      throw new CannotModifyParentTag(entry);
    }
  },

  // /**
  //  * Get all items with given tag type
  //  * @param  {ItemTagType} tagType
  //  */
  // async getItemsBy(tagType: ItemTagType) {
  //   const itemTag = await this.find({ where: { type: tagType }, relations: { item: true } });
  //   return itemTag.map(({ item }) => item);
  // },

  /**
   * Get all tags for one item
   * @param  {Item} item
   */
  async getForItem(item: Item) {
    return this.createQueryBuilder('itemTag')
      .leftJoinAndSelect('itemTag.item', 'item')
      .where('item.path @> :path', { path: item.path })
      .getMany();
  },

  /**
   * Get all tags for given items
   * @param  {Item[]} items
   */
  async getForManyItems(items: Item[]) {
    const query = this.createQueryBuilder('itemTag').leftJoinAndSelect('itemTag.item', 'item');

    items.forEach(({ path }, idx) => {
      if (idx === 0) {
        query.where(`item.path @> :path_${path}`, { [`path_${path}`]: path });
      } else {
        query.orWhere(`item.path @> :path_${path}`, { [`path_${path}`]: path });
      }
    });

    const tags = await query.getMany();

    const mapByPath = mapById({
      keys: items.map(({ path }) => path),
      findElement: (path) => tags.filter((itemTag) => path.includes(itemTag.item.path)),
    });
    // use id as key
    const idToItemTags = Object.fromEntries(
      Object.entries(mapByPath.data).map(([key, value]) => [pathToId(key), value]),
    );

    return { data: idToItemTags, errors: mapByPath.errors };
  },

  /**
   * Copy all item tags from original to copy
   * @param  {Member} creator
   * @param  {Item} original
   * @param  {Item} copy
   */
  async copyAll(creator: Member, original: Item, copy: Item) {
    // delete from parent only
    const itemTags = await this.getForItem(original);
    if (itemTags) {
      await this.insert(itemTags.map(({ type }) => ({ item: copy, type, creator })));
    }
  },
});
