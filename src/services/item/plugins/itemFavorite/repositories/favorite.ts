import { IsNull } from 'typeorm';

import { AppDataSource } from '../../../../../plugins/datasource';
import { DUPLICATE_ENTRY_ERROR_CODE } from '../../../../../utils/typeormError';
import { ItemFavorite } from '../entities/ItemFavorite';
import { DuplicateFavoriteError } from '../errors';

export const FavoriteRepository = AppDataSource.getRepository(ItemFavorite).extend({
  /**
   * Get favorite items by given memberId.
   * @param memberId user's id
   */
  async getFavoriteForMember(memberId: string): Promise<ItemFavorite[]> {
    const favorites = await this.find({
      where: { member: { id: memberId }, item: { deletedAt: IsNull() } },
      relations: { item: true },
    });
    return favorites;
  },

  async post(itemId: string, memberId: string): Promise<ItemFavorite> {
    try {
      const favorite = this.create({ item: { id: itemId }, member: { id: memberId } });
      await this.insert(favorite);
      return favorite;
    } catch (e) {
      if (e.code === DUPLICATE_ENTRY_ERROR_CODE) {
        throw new DuplicateFavoriteError({ itemId, memberId });
      }
      throw e;
    }
  },

  async deleteOne(itemId: string, memberId: string): Promise<string> {
    await this.delete({
      item: { id: itemId },
      member: { id: memberId },
    });
    return itemId;
  },
});
