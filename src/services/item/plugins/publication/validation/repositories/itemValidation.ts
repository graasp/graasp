import { eq } from 'drizzle-orm';

import { ItemValidationProcess, ItemValidationStatus } from '@graasp/sdk';

import { DBConnection } from '../../../../../../drizzle/db';
import { type ItemValidation, itemValidations } from '../../../../../../drizzle/schema';
import { ItemValidationGroupNotFound, ItemValidationNotFound } from '../errors';

export class ItemValidationRepository {
  async get(db: DBConnection, id: string): Promise<ItemValidation> {
    // additional check that id is not null
    // o/w empty parameter to findOneBy return the first entry
    if (!id) {
      throw new ItemValidationNotFound(id);
    }
    const result = await db.query.itemValidations.findFirst({ where: eq(itemValidations.id, id) });
    if (!result) {
      throw new ItemValidationNotFound(id);
    }
    return result;
  }

  async getForGroup(db: DBConnection, groupId: string): Promise<ItemValidation[]> {
    if (!groupId) {
      throw new ItemValidationGroupNotFound(groupId);
    }
    return db.query.itemValidations.findMany({
      where: eq(itemValidations.itemValidationGroupId, groupId),
    });
  }

  /**
   * Create an entry for the validation attempt in item-validation
   * @param {string} itemId id of the item being validated
   */
  async post(
    db: DBConnection,
    itemId: string,
    itemValidationGroupId: string,
    process: ItemValidationProcess,
    status = ItemValidationStatus.Pending,
  ): Promise<ItemValidation> {
    return await db
      .insert(itemValidations)
      .values({
        itemId,
        itemValidationGroupId,
        process,
        status,
      })
      .returning();
  }

  async patch(
    db: DBConnection,
    itemValidationId: string,
    args: { result?: string; status: ItemValidationStatus },
  ): Promise<ItemValidation> {
    return await db
      .update(itemValidations)
      .set(args)
      .where(eq(itemValidations.id, itemValidationId))
      .returning();
  }
}
