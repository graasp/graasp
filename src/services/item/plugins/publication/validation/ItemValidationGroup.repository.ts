import { desc, eq } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../../drizzle/db';
import { type ItemValidationGroup, itemValidationGroups } from '../../../../../drizzle/schema';
import { ItemValidationGroupNotFound } from './errors';

@singleton()
export class ItemValidationGroupRepository {
  /**
   * Get item validation groups of given iVId
   * @param {string} iVId id of the item being checked
   */
  async get(db: DBConnection, id: string): Promise<ItemValidationGroup> {
    const ivg = await db.query.itemValidationGroups.findFirst({
      where: eq(itemValidationGroups.id, id),
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
  async getLastForItem(db: DBConnection, itemId: string): Promise<ItemValidationGroup | null> {
    if (!itemId) {
      throw new ItemValidationGroupNotFound(itemId);
    }
    const result = await db.query.itemValidationGroups.findFirst({
      where: eq(itemValidationGroups.itemId, itemId),
      order: desc(itemValidationGroups.createdAt),
      with: { item: true, itemValidations: { item: true } },
    });
    return result;
  }

  /**
   * Create an entry for the automatic validation process in item-validation-group
   * @param {string} itemId id of the item being validated
   */
  async post(db: DBConnection, itemId: string): Promise<ItemValidationGroup> {
    return await db.insert(itemValidationGroups).values({ itemId }).returning()[0];
  }
}
