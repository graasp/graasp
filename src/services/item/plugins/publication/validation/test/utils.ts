import { ItemValidationProcess, ItemValidationStatus } from '@graasp/sdk';

import { registerValue } from '../../../../../../di/utils';
import { Repositories } from '../../../../../../utils/repositories';
import { Item } from '../../../../entities/Item';
import { ItemValidationGroup } from '../entities/ItemValidationGroup';
import { ItemValidationModerator } from '../moderators/itemValidationModerator';
import { StrategyExecutorFactory } from '../moderators/strategyExecutorFactory';
import { ItemValidationGroupRepository } from '../repositories/ItemValidationGroup';
import { ItemValidationRepository } from '../repositories/itemValidation';

export const saveItemValidation = async ({ item }) => {
  const group = await ItemValidationGroupRepository.save({ item });
  const itemValidation = await ItemValidationRepository.save({
    item,
    process: ItemValidationProcess.BadWordsDetection,
    status: ItemValidationStatus.Success,
    result: '',
    itemValidationGroup: group,
  });

  // get full item validation group, since save does not include itemvalidation
  const fullItemValidationGroup = await ItemValidationGroupRepository.findOne({
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
