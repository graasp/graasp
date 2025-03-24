import { ItemValidationStatus } from '@graasp/sdk';

import { registerValue } from '../../../../../../di/utils';
import { DBConnection } from '../../../../../../drizzle/db';
import { Item, ItemValidationGroupRaw } from '../../../../../../drizzle/types';
import { ItemValidationRepository } from '../itemValidation.repository';
import { ItemValidationReviewRepository } from '../itemValidationReview.repository';
import { ItemValidationModerator } from '../moderators/itemValidationModerator';
import { StrategyExecutorFactory } from '../moderators/strategyExecutorFactory';

// export const saveItemValidation = async ({ item }: { item: Item }) => {
//   const itemValidationGroupRawRepository = AppDataSource.getRepository(ItemValidationGroup);
//   const itemValidationRawRepository = AppDataSource.getRepository(ItemValidation);
//   const group = await itemValidationGroupRawRepository.save({ item });
//   const itemValidation = await itemValidationRawRepository.save({
//     item,
//     process: ItemValidationProcess.BadWordsDetection,
//     status: ItemValidationStatus.Success,
//     result: '',
//     itemValidationGroup: group,
//   });

//   // get full item validation group, since save does not include itemvalidation
//   const fullItemValidationGroup = await itemValidationGroupRawRepository.findOne({
//     where: { id: group.id },
//     relations: { itemValidations: true, item: true },
//   });
//   return { itemValidationGroup: fullItemValidationGroup, itemValidation };
// };

export type ItemModeratorValidate = (
  db: DBConnection,
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
    db: DBConnection,
    itemToValidate: Item,
    itemValidationGroupId: ItemValidationGroupRaw['id'],
  ) {
    return await this.validateImpl(db, itemToValidate, itemValidationGroupId);
  }
}

export const stubItemModerator = (validateImpl: ItemModeratorValidate) => {
  registerValue(ItemValidationModerator, new StubItemModerator(validateImpl));
};
