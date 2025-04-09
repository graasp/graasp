import { eq } from 'drizzle-orm';

import { ItemValidationReviewStatus } from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { itemValidationReviewsTable } from '../../../../../drizzle/schema';
import { ItemValidationReviewInsertDTO } from '../../../../../drizzle/types';

export class ItemValidationReviewRepository {
  // private async get(db: DBConnection, id: string): Promise<ItemValidationReview> {
  //   // additional check that id is not null
  //   // o/w empty parameter to findOneBy return the first entry
  //   if (!id) {
  //     throw new ItemValidationReviewNotFound({ id });
  //   }
  //   const result = await db.query.itemValidationReviewsTable.findFirst({
  //     where: eq(itemValidationReviewsTable.id, id),
  //   });
  //   if (!result) {
  //     throw new ItemValidationReviewNotFound({ id });
  //   }
  //   return result;
  // }

  /**
   * Create an entry for manual review
   * @param validationId id of the validation record needs manual review
   * @param status review status
   */
  async post(
    db: DBConnection,
    itemValidationId: string,
    status: ItemValidationReviewStatus,
  ): Promise<ItemValidationReviewInsertDTO> {
    const res = await db
      .insert(itemValidationReviewsTable)
      .values({
        itemValidationId,
        status,
      })
      .returning();
    return res[0];
  }

  /**
   * Update an entry for the manual validation process
   * @param itemValidationReviewEntry entry with updated data
   */
  async patch(
    db: DBConnection,
    id: string,
    status: ItemValidationReviewStatus,
    reviewerId: string,
    reason: string = '',
  ): Promise<ItemValidationReviewInsertDTO> {
    const res = await db
      .update(itemValidationReviewsTable)
      .set({ status, reason, reviewerId })
      .where(eq(itemValidationReviewsTable.id, id))
      .returning();
    return res[0];
  }
}
