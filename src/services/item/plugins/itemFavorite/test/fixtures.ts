import { AppDataSource } from '../../../../../plugins/datasource';
import { Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { ItemFavorite } from '../entities/ItemFavorite';

export const saveItemFavorites = async ({ items, member }: { items: Item[]; member: Member }) => {
  const repository = AppDataSource.getRepository(ItemFavorite);
  const favorites: ItemFavorite[] = [];

  for (const item of items) {
    const favorite = await repository.save({ item, member });
    favorites.push(favorite);
  }

  return favorites;
};
