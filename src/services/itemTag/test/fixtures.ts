import { Item } from '../../item/entities/Item';
import { Member } from '../../member/entities/member';
import { ItemTag, ItemTagType } from '../ItemTag';

export const setItemPublic = async (item: Item, creator: Member) => {
  return ItemTag.save({ item, creator, type: ItemTagType.PUBLIC });
};
