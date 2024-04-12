import { EntityManager, Repository } from 'typeorm';

import { AppDataSource } from '../../../../../plugins/datasource';
import { DUPLICATE_ENTRY_ERROR_CODE } from '../../../../../utils/typeormError';
import { Item } from '../../../entities/Item';
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

  async get(favoriteId: string): Promise<ItemFavorite> {
    if (!favoriteId) {
      throw new ItemFavoriteNotFound(favoriteId);
    }
    const favorite = await this.repository.findOne({
      where: { id: favoriteId },
      relations: { item: true, member: true },
    });

    if (!favorite) {
      throw new ItemFavoriteNotFound(favoriteId);
    }
    return favorite;
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
      .innerJoinAndSelect('item.creator', 'member')
      .where('favorite.member_id = :memberId', { memberId })
      .getMany();
    return favorites;
  }

  async getForMemberExport(memberId: string): Promise<ItemFavorite[]> {
    return await this.repository
      .createQueryBuilder('favorite')
      .where('favorite.member = :memberId', { memberId })
      .getMany();
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

  async deleteOne(itemId: string, memberId: string): Promise<Item['id']> {
    await this.repository.delete({
      item: { id: itemId },
      member: { id: memberId },
    });
    return itemId;
  }
}
