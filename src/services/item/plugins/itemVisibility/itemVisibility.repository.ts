import { inArray, isNull, or } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { type ItemVisibilityOptionsType, type ResultOf, getChildFromPath } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { isAncestorOrSelf, isDescendantOrSelf } from '../../../../drizzle/operations';
import { itemVisibilitiesTable, items, itemsRawTable } from '../../../../drizzle/schema';
import type { ItemVisibilityRaw, ItemVisibilityWithItem } from '../../../../drizzle/types';
import type { MinimalMember } from '../../../../types';
import { mapById } from '../../../utils';
import type { ItemRaw } from '../../item';
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
    dbConnection: DBConnection,
    itemPath: ItemRaw['path'],
    visibilityType: ItemVisibilityOptionsType,
    { shouldThrow = false } = {},
  ): Promise<ItemVisibilityWithItem> {
    const result = await dbConnection
      .select()
      .from(itemVisibilitiesTable)
      .innerJoin(items, eq(items.path, itemVisibilitiesTable.itemPath))
      .where(
        and(eq(itemVisibilitiesTable.type, visibilityType), isAncestorOrSelf(items.path, itemPath)),
      )
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
    dbConnection: DBConnection,
    item: ItemRaw,
    visibilityTypes: ItemVisibilityOptionsType[],
  ): Promise<ResultOf<boolean>> {
    const hasVisibilities = await dbConnection.query.itemVisibilitiesTable.findMany({
      with: { item: true },
      where: and(
        isAncestorOrSelf(itemVisibilitiesTable.itemPath, item.path),
        inArray(itemVisibilitiesTable.type, visibilityTypes),
      ),
    });

    return mapById({
      keys: visibilityTypes,
      findElement: (type) =>
        Boolean(hasVisibilities.find(({ type: thisType }) => type === thisType)),
    });
  }

  private async getManyVisibilitiesForTypes(
    dbConnection: DBConnection,
    items: ItemRaw[],
    visibilityTypes: ItemVisibilityOptionsType[],
  ): Promise<ItemVisibilityWithItem[]> {
    // we expect to query visibilities for defined items, if the items array is empty we will return an empty array.
    if (!items.length) {
      return [];
    }

    const pathsCondition = items.map(({ path }) => {
      return isAncestorOrSelf(itemVisibilitiesTable.itemPath, path);
    });

    return await dbConnection.query.itemVisibilitiesTable.findMany({
      with: { item: true },
      where: and(inArray(itemVisibilitiesTable.type, visibilityTypes), or(...pathsCondition)),
    });
  }

  async getManyForMany(
    dbConnection: DBConnection,
    items: ItemRaw[],
    visibilityTypes: ItemVisibilityOptionsType[],
  ) {
    const visibilities = await this.getManyVisibilitiesForTypes(
      dbConnection,
      items,
      visibilityTypes,
    );

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
    dbConnection: DBConnection,
    parent: ItemRaw,
    visibilityTypes: ItemVisibilityOptionsType[],
  ): Promise<ItemVisibilityWithItem[]> {
    return await dbConnection.query.itemVisibilitiesTable.findMany({
      with: { item: true },
      where: and(
        isDescendantOrSelf(itemVisibilitiesTable.itemPath, parent.path),
        inArray(itemVisibilitiesTable.type, visibilityTypes),
      ),
    });
  }

  async hasForMany(
    dbConnection: DBConnection,
    items: ItemRaw[],
    visibilityType: ItemVisibilityOptionsType,
  ): Promise<ResultOf<boolean>> {
    const pathsCondition = items.map(({ path }) => {
      return isAncestorOrSelf(itemVisibilitiesTable.itemPath, path);
    });

    const haveVisibility = await dbConnection.query.itemVisibilitiesTable.findMany({
      with: { item: true },
      where: and(eq(itemVisibilitiesTable.type, visibilityType), or(...pathsCondition)),
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
    dbConnection: DBConnection,
    creatorId: string,
    itemPath: string,
    type: ItemVisibilityOptionsType,
  ): Promise<ItemVisibilityRaw> {
    const existingVisibility = await this.getType(dbConnection, itemPath, type);
    if (existingVisibility) {
      throw new ConflictingVisibilitiesInTheHierarchy({ itemPath, type });
    }

    const result = await dbConnection
      .insert(itemVisibilitiesTable)
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
  async deleteOne(
    dbConnection: DBConnection,
    item: ItemRaw,
    type: ItemVisibilityOptionsType,
  ): Promise<void> {
    // delete from parent only
    await this.isNotInherited(dbConnection, item, type);

    // delete item visibility
    // we delete descendants visibilities, they happen on copy, move, or if you had on ancestor
    // but does not change the behavior
    // cannot use leftJoinAndSelect for delete, so we select first
    await dbConnection
      .delete(itemVisibilitiesTable)
      .where(
        and(
          isDescendantOrSelf(itemVisibilitiesTable.itemPath, item.path),
          eq(itemVisibilitiesTable.type, type),
        ),
      );
  }

  async isNotInherited(
    dbConnection: DBConnection,
    item: ItemRaw,
    type: ItemVisibilityOptionsType,
    { shouldThrow = true } = {},
  ): Promise<void> {
    const entry = await this.getType(dbConnection, item.path, type);
    if (entry && entry.item.path !== item.path && shouldThrow) {
      throw new CannotModifyParentVisibility(entry);
    }
  }

  /**
   * Get all visibilities for one item
   * @param  {Item} item
   */
  async getByItemPath(
    dbConnection: DBConnection,
    itemPath: string,
  ): Promise<ItemVisibilityWithItem[]> {
    const res = await dbConnection.query.itemVisibilitiesTable.findMany({
      where: isAncestorOrSelf(itemVisibilitiesTable.itemPath, itemPath),
      with: { item: true },
    });
    return res;
  }

  /**
   * Get all visibilities for given items
   * @throws when item array is empty, as this is considered an invalid use of the function
   * @param  {ItemRaw[]} items
   */
  async getForManyItems(
    dbConnection: DBConnection,
    inputItems: ItemRaw[],
  ): Promise<ResultOf<ItemVisibilityWithItem[]>> {
    // should not query when items array is empty
    if (!inputItems.length) {
      throw new InvalidUseOfItemVisibilityRepository();
    }

    const pathsCondition = or(
      ...inputItems.map(({ path }) => isAncestorOrSelf(itemVisibilitiesTable.itemPath, path)),
    );
    const deletedCondition = isNull(itemsRawTable.deletedAt);

    const visibilities = await dbConnection
      .select()
      .from(itemVisibilitiesTable)
      .innerJoin(itemsRawTable, eq(itemVisibilitiesTable.itemPath, itemsRawTable.path))
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
   * @param  {ItemRaw} original
   * @param  {ItemRaw} copy
   * @param  {ItemVisibilityOptionsType[] | undefined} excludeTypes
   */
  async copyAll(
    dbConnection: DBConnection,
    creator: MinimalMember,
    original: ItemRaw,
    copyPath: ItemRaw['path'],
    excludeTypes?: ItemVisibilityOptionsType[],
  ): Promise<void> {
    const originalVisibilities = await this.getByItemPath(dbConnection, original.path);
    const visibilitiesToInsert = originalVisibilities
      .filter((visibility) => !excludeTypes?.includes(visibility.type))
      .map(({ type }) => ({ itemPath: copyPath, type, creator }));

    if (visibilitiesToInsert.length) {
      await dbConnection.insert(itemVisibilitiesTable).values(visibilitiesToInsert);
      // await this.repository.insert(
      //   itemVisibilitiesTable
      //     .filter((visibility) => !excludeTypes?.includes(visibility.type))
      //     .map(({ type }) => ({ item: { path: copy.path }, type, creator })),
      // );
    }
  }
}
