import { ItemValidationStatus } from '@graasp/sdk';

import { registerValue } from '../../../../../../di/utils';
import { DBConnection } from '../../../../../../drizzle/db';
import { Item, ItemValidationGroupRaw } from '../../../../../../drizzle/types';
import { ItemValidationRepository } from '../itemValidation.repository';
import { ItemValidationReviewRepository } from '../itemValidationReview.repository';
import { ItemValidationModerator } from '../moderators/itemValidationModerator';
import { StrategyExecutorFactory } from '../moderators/strategyExecutorFactory';

export type ItemModeratorValidate = (
  dbConnection: DBConnection,
  itemToValidate: Item,
  itemValidationGroupId: ItemValidationGroupRaw['id'],
) => Promise<ItemValidationStatus[]>;

class StubItemModerator extends ItemValidationModerator {
  constructor(private readonly validateImpl: ItemModeratorValidate) {
    super(
      {} as StrategyExecutorFactory,
      {} as ItemValidationRepository,
      {} as ItemValidationReviewRepository,
    );
  }

  async validate(
    dbConnection: DBConnection,
    itemToValidate: Item,
    itemValidationGroupId: ItemValidationGroupRaw['id'],
  ) {
    return await this.validateImpl(dbConnection, itemToValidate, itemValidationGroupId);
  }
}

export const stubItemModerator = (validateImpl: ItemModeratorValidate) => {
  registerValue(ItemValidationModerator, new StubItemModerator(validateImpl));
};
