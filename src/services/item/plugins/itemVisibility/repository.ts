import { and, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';
import { Brackets } from 'typeorm';

import { ItemVisibilityOptionsType, ResultOf, getChildFromPath } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { isAncestorOrSelf } from '../../../../drizzle/operations';
import { itemVisibilities, items } from '../../../../drizzle/schema';
import { EntryNotFoundAfterInsertException } from '../../../../repositories/errors';
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

@singleton()
export class ItemVisibilityRepository {
  async getType(
    db: DBConnection,
    itemPath: Item['path'],
    visibilityType: ItemVisibilityOptionsType,
    { shouldThrow = false } = {},
  ) {
    const result = await db
      .select()
      .from(itemVisibilities)
      .innerJoin(items, eq(items.path, itemVisibilities.itemPath))
      .where(and(eq(itemVisibilities.type, visibilityType), isAncestorOrSelf(items.path, itemPath)))
      .limit(1);

    if (shouldThrow && result.length != 1) {
      throw new ItemVisibilityNotFound(visibilityType);
    }

    return result.map(({ item_view, item_visibility }) => ({
      ...item_visibility,
      item: item_view,
    }))[0];
  }

  /**
   * return the item's visibilities
   * @param item
   * @param visibilityTypes
   * @returns map type => whether item has this visibility type
   */
  async hasMany(item: Item, visibilityTypes: ItemVisibilityOptionsType[]) {
    const hasVisibilities = await this.repository
      .createQueryBuilder('itemVisibility')
      .leftJoinAndSelect('itemVisibility.item', 'item')
      .where('itemVisibility.item @> :path', { path: item.path })
      .andWhere('itemVisibility.type IN (:...types)', { types: visibilityTypes })
      .getMany();

    return mapById({
      keys: visibilityTypes,
      findElement: (type) =>
        Boolean(hasVisibilities.find(({ type: thisType }) => type === thisType)),
    });
  }

  private async getManyVisibilitiesForTypes(
    items: Item[],
    visibilityTypes: ItemVisibilityOptionsType[],
  ): Promise<ItemVisibility[]> {
    // we expect to query visibilities for defined items, if the items array is empty we will return an empty array.
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

    const hasVisibilities: ItemVisibility[] = await query
      .andWhere('itemVisibility.type IN (:...types)', { types: visibilityTypes })
      .getMany();
    return hasVisibilities;
  }

  async getManyForMany(
    items: Item[],
    visibilityTypes: ItemVisibilityOptionsType[],
  ): Promise<ResultOf<ItemVisibility[]>> {
    const visibilities = await this.getManyVisibilitiesForTypes(items, visibilityTypes);

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
   * return visibility for all items below the given item, including the itself
   * @param parent item used to refer to its descendants
   * @param visibilityTypes visibility types to retrieve
   * @returns visibility array
   */
  async getManyBelowAndSelf(
    parent: Item,
    visibilityTypes: ItemVisibilityOptionsType[],
  ): Promise<ItemVisibility[]> {
    const query = this.repository
      .createQueryBuilder('itemVisibility')
      .leftJoinAndSelect('itemVisibility.item', 'item');

    query.where(`item.path <@ :path`, { path: parent.path });

    const visibilities: ItemVisibility[] = await query
      .andWhere('itemVisibility.type IN (:...types)', { types: visibilityTypes })
      .getMany();

    return visibilities;
  }

  async hasForMany(
    items: Item[],
    visibilityType: ItemVisibilityOptionsType,
  ): Promise<ResultOf<boolean>> {
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

    const haveVisibility = await query
      .andWhere('itemVisibility.type = :type', { type: visibilityType })
      .getMany();

    const mapByPath = mapById({
      keys: items.map(({ path }) => path),
      findElement: (path) =>
        Boolean(haveVisibility.find((itemVisibility) => path.includes(itemVisibility.item.path))),
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
   * @param  {ItemVisibilityOptionsType} type
   */
  async post(
    db: DBConnection,
    creatorId: string,
    itemPath: string,
    type: ItemVisibilityOptionsType,
  ) {
    const existingVisibility = await this.getType(db, itemPath, type);
    if (existingVisibility) {
      throw new ConflictingVisibilitiesInTheHierarchy({ itemPath, type });
    }

    const result = await db
      .insert(itemVisibilities)
      .values({ itemPath: itemPath, type, creatorId: creatorId })
      .returning();
    if (result.length != 1) {
      throw new EntryNotFoundAfterInsertException(ItemVisibility);
    }
    return result[0];
  }

  /**
   * Delete one visibility item given the item and type
   * @param  {Item} item
   * @param  {ItemVisibilityOptionsType} type
   */
  async deleteOne(db: DBConnection, item: Item, type: ItemVisibilityOptionsType) {
    // delete from parent only
    await this.isNotInherited(db, item, type);

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

  async isNotInherited(
    db: DBConnection,
    item: Item,
    type: ItemVisibilityOptionsType,
    { shouldThrow = true } = {},
  ) {
    const entry = await this.getType(db, item.path, type);
    if (entry && entry.item.path !== item.path && shouldThrow) {
      throw new CannotModifyParentVisibility(entry);
    }
  }

  /**
   * Get all visibilities for one item
   * @param  {Item} item
   */
  async getByItemPath(db: DBConnection, itemPath: string) {
    const res = await db.query.itemVisibilities.findMany({
      where: isAncestorOrSelf(itemVisibilities.itemPath, itemPath),
      with: { item: true },
    });
    return res;
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
   * @param  {ItemVisibilityOptionsType[] | undefined} excludeTypes
   */
  async copyAll(
    db: DBConnection,
    creator: Member,
    original: Item,
    copy: Item,
    excludeTypes?: ItemVisibilityOptionsType[],
  ) {
    const originalVisibilities = await this.getByItemPath(db, original.path);
    if (originalVisibilities) {
      await db
        .insert(itemVisibilities)
        .values(
          itemVisibilities
            .filter((visibility) => !excludeTypes?.includes(visibility.type))
            .map(({ type }) => ({ itemPath: copy.path, type, creator })),
        );
      // await this.repository.insert(
      //   itemVisibilities
      //     .filter((visibility) => !excludeTypes?.includes(visibility.type))
      //     .map(({ type }) => ({ item: { path: copy.path }, type, creator })),
      // );
    }
  }
}
