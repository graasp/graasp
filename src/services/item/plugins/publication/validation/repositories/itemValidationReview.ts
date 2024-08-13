import { EntityManager } from 'typeorm';

import { ItemValidationReviewStatus } from '@graasp/sdk';

import { AbstractRepository } from '../../../../../../repositories/AbstractRepository';
import { ItemValidationReview } from '../entities/itemValidationReview';
import { ItemValidationReviewNotFound } from '../errors';

export class ItemValidationReviewRepository extends AbstractRepository<ItemValidationReview> {
  constructor(manager?: EntityManager) {
    super(ItemValidationReview, manager);
  }

  private async get(id: string): Promise<ItemValidationReview> {
    // additional check that id is not null
    // o/w empty parameter to findOneBy return the first entry
    if (!id) {
      throw new ItemValidationReviewNotFound({ id });
    }
    const result = await this.repository.findOneBy({ id });
    if (!result) {
      throw new ItemValidationReviewNotFound({ id });
    }
    return result;
  }

  /**
   * Create an entry for manual review
   * @param validationId id of the validation record needs manual review
   * @param status review status
   */
  async post(
    itemValidationId: string,
    status: ItemValidationReviewStatus,
  ): Promise<ItemValidationReview> {
    const created = await this.repository.insert({
      itemValidation: { id: itemValidationId },
      status,
    });
    return this.get(created.identifiers[0].id);
  }

  /**
   * Update an entry for the manual validation process
   * @param itemValidationReviewEntry entry with updated data
   */
  async patch(
    id: string,
    status: ItemValidationReviewStatus,
    reviewerId: string,
    reason: string = '',
  ): Promise<ItemValidationReview> {
    await this.repository.update(id, { status, reason, reviewer: { id: reviewerId } });
    return this.get(id);
  }
}
