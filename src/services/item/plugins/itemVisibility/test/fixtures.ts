import { DeepPartial } from 'typeorm';

import { ItemVisibilityType } from '@graasp/sdk';

import { Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { ItemVisibility } from '../ItemVisibility';

export const setItemPublic = async (item: Item, creator?: Member | null) => {
  return ItemVisibility.save({ item, creator, type: ItemVisibilityType.Public });
};

export const createTag = async (args: DeepPartial<ItemVisibility>) => {
  return ItemVisibility.create(args);
};
