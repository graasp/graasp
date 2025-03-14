import { Item, ItemBookmarkRaw } from '../../../../../drizzle/types.js';
import { MinimalMember } from '../../../../../types.js';

export const saveItemFavorites = async ({
  items,
  member,
}: {
  items: Item[];
  member: MinimalMember;
}) => {
  const repository = AppDataSource.getRepository(ItemFavorite);
  const favorites: ItemBookmarkRaw[] = [];

  for (const item of items) {
    const favorite = await repository.save({ item, member });
    favorites.push(favorite);
  }

  return favorites;
};
