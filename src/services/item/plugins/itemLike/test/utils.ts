import { Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { ItemLike } from '../itemLike';
import { ItemLikeRepository } from '../repository';

export const saveItemLikes = async (items: Item[], member: Member) => {
  const likes: ItemLike[] = [];
  for (const item of items) {
    const like = await new ItemLikeRepository().addOne({ itemId: item.id, creatorId: member.id });
    likes.push(like);
  }
  return likes;
};
