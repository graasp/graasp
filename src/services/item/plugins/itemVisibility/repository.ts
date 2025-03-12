import { inArray, isNotNull, isNull, or } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { ItemVisibilityOptionsType, ResultOf, getChildFromPath } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { isAncestorOrSelf, isDescendantOrSelf } from '../../../../drizzle/operations';
import { itemVisibilities, items, itemsRaw } from '../../../../drizzle/schema';
import { Item, ItemVisibilityRaw, ItemVisibilityWithItem } from '../../../../drizzle/types';
import { MinimalMember } from '../../../../types';
import { mapById } from '../../../utils';
import {
  CannotModifyParentVisibility,
  ConflictingVisibilitiesInTheHierarchy,
  InvalidUseOfItemVisibilityRepository,
  ItemVisibilityNotFound,
} from './errors';

@singleton()
export class ItemVisibilityRepository {
  constructor() {}

  async getType(
    db: DBConnection,
    itemPath: Item['path'],
    visibilityType: ItemVisibilityOptionsType,
    { shouldThrow = false } = {},
  ): Promise<ItemVisibilityWithItem> {
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
  async hasMany(
    db: DBConnection,
    item: Item,
    visibilityTypes: ItemVisibilityOptionsType[],
  ): Promise<ResultOf<boolean>> {
    const hasVisibilities = await db.query.itemVisibilities.findMany({
      with: { item: true },
      where: and(
        isAncestorOrSelf(itemVisibilities.itemPath, item.path),
        inArray(itemVisibilities.type, visibilityTypes),
      ),
    });

    return mapById({
      keys: visibilityTypes,
      findElement: (type) =>
        Boolean(hasVisibilities.find(({ type: thisType }) => type === thisType)),
    });
  }

  private async getManyVisibilitiesForTypes(
    db: DBConnection,
    items: Item[],
    visibilityTypes: ItemVisibilityOptionsType[],
  ): Promise<ItemVisibilityWithItem[]> {
    // we expect to query visibilities for defined items, if the items array is empty we will return an empty array.
    if (!items.length) {
      return [];
    }

    const pathsCondition = items.map(({ path }) => {
      return isAncestorOrSelf(itemVisibilities.itemPath, path);
    });

    return await db.query.itemVisibilities.findMany({
      with: { item: true },
      where: and(inArray(itemVisibilities.type, visibilityTypes), or(...pathsCondition)),
    });
  }

  async getManyForMany(
    db: DBConnection,
    items: Item[],
    visibilityTypes: ItemVisibilityOptionsType[],
  ) {
    const visibilities = await this.getManyVisibilitiesForTypes(db, items, visibilityTypes);

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
    db: DBConnection,
    parent: Item,
    visibilityTypes: ItemVisibilityOptionsType[],
  ) {
    return await db.query.itemVisibilities.findMany({
      with: { item: true },
      where: and(
        isDescendantOrSelf(itemVisibilities.itemPath, parent.path),
        inArray(itemVisibilities.type, visibilityTypes),
      ),
    });
  }

  async hasForMany(
    db: DBConnection,
    items: Item[],
    visibilityType: ItemVisibilityOptionsType,
  ): Promise<ResultOf<boolean>> {
    const pathsCondition = items.map(({ path }) => {
      return isAncestorOrSelf(itemVisibilities.itemPath, path);
    });

    const haveVisibility = await db.query.itemVisibilities.findMany({
      with: { item: true },
      where: and(eq(itemVisibilities.type, visibilityType), or(...pathsCondition)),
    });

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
  ): Promise<ItemVisibilityRaw> {
    const existingVisibility = await this.getType(db, itemPath, type);
    if (existingVisibility) {
      throw new ConflictingVisibilitiesInTheHierarchy({ itemPath, type });
    }

    const result = await db
      .insert(itemVisibilities)
      .values({ itemPath: itemPath, type, creatorId: creatorId })
      .returning();
    if (result.length != 1) {
      throw new Error('Entitiy not found after insert: ItemVisibility');
    }
    return result[0];
  }

  /**
   * Delete one visibility item given the item and type
   * @param  {Item} item
   * @param  {ItemVisibilityOptionsType} type
   */
  async deleteOne(db: DBConnection, item: Item, type: ItemVisibilityOptionsType): Promise<void> {
    // delete from parent only
    await this.isNotInherited(db, item, type);

    // delete item visibility
    // we delete descendants visibilities, they happen on copy, move, or if you had on ancestor
    // but does not change the behavior
    // cannot use leftJoinAndSelect for delete, so we select first
    await db
      .delete(itemVisibilities)
      .where(
        and(
          isDescendantOrSelf(itemVisibilities.itemPath, item.path),
          eq(itemVisibilities.type, type),
        ),
      );
  }

  async isNotInherited(
    db: DBConnection,
    item: Item,
    type: ItemVisibilityOptionsType,
    { shouldThrow = true } = {},
  ): Promise<void> {
    const entry = await this.getType(db, item.path, type);
    if (entry && entry.item.path !== item.path && shouldThrow) {
      throw new CannotModifyParentVisibility(entry);
    }
  }

  /**
   * Get all visibilities for one item
   * @param  {Item} item
   */
  async getByItemPath(db: DBConnection, itemPath: string): Promise<ItemVisibilityWithItem[]> {
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
  async getForManyItems(
    db: DBConnection,
    inputItems: Item[],
    { withDeleted = false }: { withDeleted?: boolean } = {},
  ): Promise<ResultOf<ItemVisibilityWithItem[]>> {
    // should not query when items array is empty
    if (!inputItems.length) {
      throw new InvalidUseOfItemVisibilityRepository();
    }

    const pathsCondition = or(
      ...inputItems.map(({ path }) => isAncestorOrSelf(itemVisibilities.itemPath, path)),
    );
    const deletedCondition = withDeleted
      ? isNotNull(itemsRaw.deletedAt)
      : isNull(itemsRaw.deletedAt);

    const visibilities = await db
      .select()
      .from(itemVisibilities)
      .innerJoin(itemsRaw, eq(itemVisibilities.itemPath, itemsRaw.path))
      .where(and(pathsCondition, deletedCondition));

    const transformedVisibilities = visibilities.map(({ item, item_visibility }) => ({
      item,
      ...item_visibility,
    }));

    const mapByPath = mapById({
      keys: inputItems.map(({ path }) => path),
      findElement: (path) =>
        transformedVisibilities.filter((itemVisibility) => path.includes(itemVisibility.item.path)),
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
    creator: MinimalMember,
    original: Item,
    copyPath: Item['path'],
    excludeTypes?: ItemVisibilityOptionsType[],
  ): Promise<void> {
    const originalVisibilities = await this.getByItemPath(db, original.path);
    if (originalVisibilities) {
      await db
        .insert(itemVisibilities)
        .values(
          originalVisibilities
            .filter((visibility) => !excludeTypes?.includes(visibility.type))
            .map(({ type }) => ({ itemPath: copyPath, type, creator })),
        );
      // await this.repository.insert(
      //   itemVisibilities
      //     .filter((visibility) => !excludeTypes?.includes(visibility.type))
      //     .map(({ type }) => ({ item: { path: copy.path }, type, creator })),
      // );
    }
  }
}
