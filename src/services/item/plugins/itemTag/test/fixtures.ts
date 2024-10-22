import { DeepPartial } from 'typeorm';

import { ItemTagType } from '@graasp/sdk';

import { Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { ItemTag } from '../ItemTag';

export const setItemPublic = async (item: Item, creator?: Member | null) => {
  return ItemTag.save({ item, creator, type: ItemTagType.Public });
};

export const createTag = async (args: DeepPartial<ItemTag>) => {
  return ItemTag.create(args);
};
