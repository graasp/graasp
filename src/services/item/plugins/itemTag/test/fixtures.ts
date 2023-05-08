import { ItemTagType } from '@graasp/sdk';

import { Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { ItemTag } from '../ItemTag';

export const setItemPublic = async (item: Item, creator: Member) => {
  return ItemTag.save({ item, creator, type: ItemTagType.PUBLIC });
};
