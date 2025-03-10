import { ItemVisibilityType } from '@graasp/sdk';

import { Item } from '../../../../../drizzle/types';
import { MinimalMember } from '../../../../../types';

export const setItemPublic = async (item: Item, creator?: MinimalMember | null) => {
  return ItemVisibility.save({ item, creator, type: ItemVisibilityType.Public });
};

export const createTag = async (args: DeepPartial<ItemVisibility>) => {
  return ItemVisibility.create(args);
};
