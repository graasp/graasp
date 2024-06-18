import { AppDataSource } from '../../../../../plugins/datasource.js';
import { Member } from '../../../../member/entities/member.js';
import { Item } from '../../../entities/Item.js';
import { ItemFavorite } from '../entities/ItemFavorite.js';

export const saveItemFavorites = async ({ items, member }: { items: Item[]; member: Member }) => {
  const repository = AppDataSource.getRepository(ItemFavorite);
  const favorites: ItemFavorite[] = [];

  for (const item of items) {
    const favorite = await repository.save({ item, member });
    favorites.push(favorite);
  }

  return favorites;
};
