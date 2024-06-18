import { ItemTagType } from '@graasp/sdk';

import { Actor } from '../../../../member/entities/member.js';
import { Item } from '../../../entities/Item.js';
import { ItemTag } from '../ItemTag.js';

export const setItemPublic = async (item: Item, creator?: Actor | null) => {
  return ItemTag.save({ item, creator, type: ItemTagType.Public });
};
