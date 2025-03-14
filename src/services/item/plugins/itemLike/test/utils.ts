import { db } from '../../../../../drizzle/db.js';
import { Item, ItemLikeRaw } from '../../../../../drizzle/types.js';
import { MinimalMember } from '../../../../../types.js';
import { ItemLikeRepository } from '../itemLike.repository.js';

export const saveItemLikes = async (items: Item[], member: MinimalMember) => {
  const likes: ItemLikeRaw[] = [];
  for (const item of items) {
    const like = await new ItemLikeRepository().addOne(db, {
      itemId: item.id,
      creatorId: member.id,
    });
    likes.push(like);
  }
  return likes;
};
