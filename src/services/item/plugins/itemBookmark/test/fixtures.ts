import { Item, ItemBookmarkRaw } from '../../../../../drizzle/types';
import { MinimalMember } from '../../../../../types';

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
