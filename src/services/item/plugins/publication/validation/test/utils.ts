import { ItemValidationProcess, ItemValidationStatus } from '@graasp/sdk';

import { registerValue } from '../../../../../../di/utils.js';
import { Item } from '../../../../../../drizzle/types.js';
import { ItemValidationModerator } from '../moderators/itemValidationModerator.js';
import { StrategyExecutorFactory } from '../moderators/strategyExecutorFactory.js';

export const saveItemValidation = async ({ item }: { item: Item }) => {
  const itemValidationGroupRawRepository = AppDataSource.getRepository(ItemValidationGroup);
  const itemValidationRawRepository = AppDataSource.getRepository(ItemValidation);
  const group = await itemValidationGroupRawRepository.save({ item });
  const itemValidation = await itemValidationRawRepository.save({
    item,
    process: ItemValidationProcess.BadWordsDetection,
    status: ItemValidationStatus.Success,
    result: '',
    itemValidationGroup: group,
  });

  // get full item validation group, since save does not include itemvalidation
  const fullItemValidationGroup = await itemValidationGroupRawRepository.findOne({
    where: { id: group.id },
    relations: { itemValidations: true, item: true },
  });
  return { itemValidationGroup: fullItemValidationGroup, itemValidation };
};

export type ItemModeratorValidate = (
  _repositories: Repositories,
  itemToValidate: Item,
  _itemValidationGroup: ItemValidationGroup,
) => Promise<ItemValidationStatus[]>;

class StubItemModerator extends ItemValidationModerator {
  constructor(private readonly validateImpl: ItemModeratorValidate) {
    super({} as StrategyExecutorFactory);
  }

  async validate(
    repositories: Repositories,
    itemToValidate: Item,
    itemValidationGroup: ItemValidationGroup,
  ) {
    return await this.validateImpl(repositories, itemToValidate, itemValidationGroup);
  }
}

export const stubItemModerator = (validateImpl: ItemModeratorValidate) => {
  registerValue(ItemValidationModerator, new StubItemModerator(validateImpl));
};
