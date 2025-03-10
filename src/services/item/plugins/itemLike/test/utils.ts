import { Item, ItemLikeRaw } from '../../../../../drizzle/types';
import { MinimalMember } from '../../../../../types';
import { ItemLikeRepository } from '../repository';

export const saveItemLikes = async (items: Item[], member: MinimalMember) => {
  const likes: ItemLikeRaw[] = [];
  for (const item of items) {
    const like = await new ItemLikeRepository().addOne({ itemId: item.id, creatorId: member.id });
    likes.push(like);
  }
  return likes;
};
