import { AppDataSource } from '../../../../../plugins/datasource';
import { ItemValidation } from '../entities/ItemValidation';
import { ItemValidationReview, ItemValidationReviewStatus } from '../entities/itemValidationReview';

export const ItemValidationReviewRepository = AppDataSource.getRepository(ItemValidation).extend({
  /**
   * Create an entry for manual review
   * @param validationId id of the validation record needs manual review
   * @param status review status
   */
  async post(
    itemValidationId: string,
    status: ItemValidationReviewStatus,
  ): Promise<ItemValidationReview> {
    const entry = this.create({ itemValidationId, status });
    await this.insert(entry);
    return entry;
  },

  /**
   * Update an entry for the manual validation process
   * @param itemValidationReviewEntry entry with updated data
   */
  async patch(
    id: string,
    status: ItemValidationReviewStatus,
    reason: string = '',
    reviewerId: string,
  ): Promise<ItemValidationReview> {
    return this.update(id, { status, reason, reviewerId });
  },
});
