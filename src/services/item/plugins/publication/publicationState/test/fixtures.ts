import { v4 } from 'uuid';

import {
  ItemValidationProcess,
  ItemValidationStatus,
  ItemVisibilityType,
  buildPathFromIds,
} from '@graasp/sdk';

import type { ItemVisibilityRaw } from '../../../../../../drizzle/types';
import type { ItemMetadata, ItemValidationGroupStatus } from '../types';

export const ItemMetadataFactory = (
  item?: Partial<ItemMetadata> & { parentItem?: ItemMetadata },
  isPublic?: boolean,
): ItemMetadata => {
  const path = item?.path ?? v4();

  return {
    updatedAt: item?.updatedAt ?? new Date().toISOString(),
    path: item?.parentItem ? buildPathFromIds[(item.parentItem.path, path)] : path,
    type: item?.type ?? 'folder',
    public: isPublic ? ({ type: ItemVisibilityType.Public } as ItemVisibilityRaw) : undefined,
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
    createdAt: validationDate.toISOString(),
    itemValidations: [
      ivFactory(ItemValidationProcess.BadWordsDetection),
      ivFactory(ItemValidationProcess.ImageChecking),
    ],
  };
};
