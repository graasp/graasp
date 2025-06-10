import { desc, eq } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { type DBConnection } from '../../../../../drizzle/db';
import { itemValidationGroupsTable } from '../../../../../drizzle/schema';
import type {
  ItemValidationGroupRaw,
  ItemValidationGroupWithItemAndValidations,
} from '../../../../../drizzle/types';
import { ItemValidationGroupNotFound } from './errors';

@singleton()
export class ItemValidationGroupRepository {
  /**
   * Get item validation groups of given iVId
   * @param {string} iVId id of the item being checked
   */
  async get(
    dbConnection: DBConnection,
    id: string,
  ): Promise<ItemValidationGroupWithItemAndValidations> {
    const ivg = await dbConnection.query.itemValidationGroupsTable.findFirst({
      where: eq(itemValidationGroupsTable.id, id),
      with: { item: true, itemValidations: true },
    });

    if (!ivg) {
      throw new ItemValidationGroupNotFound(id);
    }

    return ivg;
  }

  /**
   * Get last item validation group for given item id
   * @param {string} itemId id of the item being checked
   */
  async getLastForItem(
    dbConnection: DBConnection,
    itemId: string,
  ): Promise<ItemValidationGroupWithItemAndValidations | undefined> {
    if (!itemId) {
      throw new ItemValidationGroupNotFound(itemId);
    }
    const result = await dbConnection.query.itemValidationGroupsTable.findFirst({
      where: eq(itemValidationGroupsTable.itemId, itemId),
      orderBy: desc(itemValidationGroupsTable.createdAt),
      with: { item: true, itemValidations: true },
    });
    return result;

    // const result = await dbConnection
    //   .select()
    //   .from(itemValidationGroupsTable)
    //   .innerJoin(items, eq(itemValidationGroupsTable.itemId, itemId))
    //   .innerJoin(
    //     itemValidations,
    //     eq(itemValidationGroupsTable.id, itemValidations.itemValidationGroupId),
    //   )
    //   // needed?
    //   // get items in item validations, linked to wanter item validation group
    //   // .innerJoin(items, eq(items.id, itemValidations.itemId))
    //   .where(eq(itemValidationGroupsTable.itemId, itemId))
    //   .orderBy(desc(itemValidationGroupsTable.createdAt))
    //   .limit(0);

    // return result.reduce<ItemValidationGroupWithItemAndValidationsWithItem>(
    //   (acc, { item_validation }) => {
    //     acc.itemValidations.push(item_validation);

    //     return acc;
    //   },
    //   { itemValidations: [], item:  },
    // );
  }

  /**
   * Create an entry for the automatic validation process in item-validation-group
   * @param {string} itemId id of the item being validated
   */
  async post(
    dbConnection: DBConnection,
    itemId: string,
  ): Promise<{ id: ItemValidationGroupRaw['id'] }> {
    const res = await dbConnection
      .insert(itemValidationGroupsTable)
      .values({ itemId })
      .returning({ id: itemValidationGroupsTable.id });
    return res[0];
  }
}
