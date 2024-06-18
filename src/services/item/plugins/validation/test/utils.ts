import { ItemValidationProcess, ItemValidationStatus } from '@graasp/sdk';

import { ItemValidationGroupRepository } from '../repositories/ItemValidationGroup.js';
import { ItemValidationRepository } from '../repositories/itemValidation.js';

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
