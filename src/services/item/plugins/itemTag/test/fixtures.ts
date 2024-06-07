import { ItemTagType } from '@graasp/sdk';

import { Actor } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { ItemTag } from '../ItemTag';

export const setItemPublic = async (item: Item, creator?: Actor | null) => {
  return ItemTag.save({ item, creator, type: ItemTagType.Public });
};

export const setItemHidden = async (item: Item, creator?: Actor | null) => {
  return ItemTag.save({ item, creator, type: ItemTagType.Hidden });
};
