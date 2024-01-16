import { EntityManager, Repository } from 'typeorm';

import { AppDataSource } from '../../../../../plugins/datasource';
import { DUPLICATE_ENTRY_ERROR_CODE } from '../../../../../utils/typeormError';
import { ItemFavorite } from '../entities/ItemFavorite';
import { DuplicateFavoriteError, ItemFavoriteNotFound } from '../errors';

export class FavoriteRepository {
  private repository: Repository<ItemFavorite>;

  constructor(manager?: EntityManager) {
    if (manager) {
      this.repository = manager.getRepository(ItemFavorite);
    } else {
      this.repository = AppDataSource.getRepository(ItemFavorite);
    }
  }

  /**
   * Get favorite items by given memberId.
   * @param memberId user's id
   */
  async getFavoriteForMember(memberId: string): Promise<ItemFavorite[]> {
    // alias item_favorite table to favorite
    const favorites = await this.repository
      .createQueryBuilder('favorite')
      // add relation to item, but use innerJoin to remove item that have been soft-deleted
      .innerJoinAndSelect('favorite.item', 'item')
      .where('favorite.member_id = :memberId', { memberId })
      .getMany();
    return favorites;
  }

  async get(favoriteId: string): Promise<ItemFavorite> {
    if (!favoriteId) {
      throw new ItemFavoriteNotFound(favoriteId);
    }

    return await this.repository.findOneByOrFail({ id: favoriteId });
  }

  async post(itemId: string, memberId: string): Promise<ItemFavorite> {
    try {
      const created = await this.repository.insert({
        item: { id: itemId },
        member: { id: memberId },
      });

      return this.get(created.identifiers[0].id);
    } catch (e) {
      if (e.code === DUPLICATE_ENTRY_ERROR_CODE) {
        throw new DuplicateFavoriteError({ itemId, memberId });
      }
      throw e;
    }
  }

  async deleteOne(itemId: string, memberId: string): Promise<string> {
    await this.repository.delete({
      item: { id: itemId },
      member: { id: memberId },
    });
    return itemId;
  }
}
