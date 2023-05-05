import { ItemTagType } from '@graasp/sdk';

import { ItemTag } from '../ItemTag';
import { Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';

export const setItemPublic = async (item: Item, creator: Member) => {
  return ItemTag.save({ item, creator, type: ItemTagType.PUBLIC });
};
