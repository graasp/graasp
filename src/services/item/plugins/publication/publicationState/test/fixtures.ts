import { v4 } from 'uuid';

import {
  ItemType,
  ItemValidationProcess,
  ItemValidationStatus,
  ItemVisibilityType,
  buildPathFromIds,
} from '@graasp/sdk';

import { ItemVisibility } from '../../../itemVisibility/ItemVisibility';
import { ItemMetadata, ItemValidationGroupStatus } from '../types';

export const ItemMetadataFactory = (
  item?: Partial<ItemMetadata> & { parentItem?: ItemMetadata },
  isPublic?: boolean,
): ItemMetadata => {
  const path = item?.path ?? v4();

  return {
    updatedAt: item?.updatedAt ?? new Date(),
    path: item?.parentItem ? buildPathFromIds[(item.parentItem.path, path)] : path,
    type: item?.type ?? ItemType.FOLDER,
    public: isPublic ? ({ type: ItemVisibilityType.Public } as ItemVisibility) : undefined,
  };
};

export const ItemValidationGroupStatusFactory = (
  validatedItem: ItemMetadata,
  {
    status = ItemValidationStatus.Success,
    isOutDated = false,
  }: {
    status?: ItemValidationStatus;
    isOutDated?: boolean;
  } = { status: ItemValidationStatus.Success, isOutDated: false },
): ItemValidationGroupStatus => {
  const itemUpdateDate = new Date(validatedItem.updatedAt);
  const shiftDate = isOutDated ? -1 : +1;
  const validationDate = new Date(itemUpdateDate);
  validationDate.setDate(validationDate.getDate() + shiftDate);

  const ivFactory = (process: ItemValidationProcess) => ({
    process,
    status,
  });

  return {
    createdAt: validationDate,
    itemValidations: [
      ivFactory(ItemValidationProcess.BadWordsDetection),
      ivFactory(ItemValidationProcess.ImageChecking),
    ],
  };
};
