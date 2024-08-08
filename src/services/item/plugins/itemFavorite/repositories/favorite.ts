import { EntityManager } from 'typeorm';

import { AbstractRepository } from '../../../../../repository';
import { DUPLICATE_ENTRY_ERROR_CODE } from '../../../../../utils/typeormError';
import { MemberIdentifierNotFound } from '../../../../itemLogin/errors';
import { itemFavoriteSchema } from '../../../../member/plugins/export-data/schemas/schemas';
import { schemaToSelectMapper } from '../../../../member/plugins/export-data/utils/selection.utils';
import { Item } from '../../../entities/Item';
import { ItemFavorite } from '../entities/ItemFavorite';
import { DuplicateFavoriteError, ItemFavoriteNotFound } from '../errors';

export class FavoriteRepository extends AbstractRepository<ItemFavorite> {
  constructor(manager?: EntityManager) {
    super(ItemFavorite, manager);
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

  /**
   * Return all the favorite items of the given member.
   * @param memberId ID of the member to retrieve the data.
   * @returns an array of favorites.
   */
  async getForMemberExport(memberId: string): Promise<ItemFavorite[]> {
    if (!memberId) {
      throw new MemberIdentifierNotFound();
    }

    return this.repository.find({
      select: schemaToSelectMapper(itemFavoriteSchema),
      where: { member: { id: memberId } },
      order: { createdAt: 'DESC' },
      relations: {
        item: true,
      },
    });
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
