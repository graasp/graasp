import { Member } from '../../../../member/entities/member.js';
import { Item } from '../../../entities/Item.js';
import { ItemLike } from '../itemLike.js';
import { ItemLikeRepository } from '../repository.js';

export const saveItemLikes = async (items: Item[], member: Member) => {
  const likes: ItemLike[] = [];
  for (const item of items) {
    const like = await ItemLikeRepository.save({ item, creator: member });
    likes.push(like);
  }
  return likes;
};
