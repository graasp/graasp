import { AppDataSource } from '../../../../plugins/datasource';
import { Item } from '../../../item/entities/Item';
import { Member } from '../../../member/entities/member';
import { ItemLikeNotFound } from './errors';
import { ItemLike } from './itemLike';

export const ItemLikeRepository = AppDataSource.getRepository(ItemLike).extend({
  get(entryId: string) {
    return this.findOneBy({ id: entryId });
  },

  /**
   * Get item likes by given memberId.
   * @param memberId user's id
   */
  async getForMember(memberId: string): Promise<ItemLike[]> {
    const itemLikes = await this.createQueryBuilder('itemLike')
      .innerJoinAndSelect('itemLike.item', 'item')
      .where('itemLike.creator = :memberId', { memberId })
      .getMany();
    return itemLikes;
  },

  /**
   * Get likes for item
   * @param itemId
   */
  async getForItem(itemId: string): Promise<ItemLike[]> {
    const itemLikes = await this.createQueryBuilder('itemLike')
      .innerJoinAndSelect('itemLike.item', 'item')
      .where('itemLike.item = :itemId', { itemId })
      .getMany();
    return itemLikes;
  },

  /**
   * create an item like
   * @param memberId user's id
   * @param itemId item's id
   */
  async post(memberId: string, itemId: string): Promise<ItemLike> {
    const newLike = this.create({ item: { id: itemId }, creator: { id: memberId } });
    await this.insert(newLike);
    return newLike;
  },

  /**
   * delete an item like
   * @param memberId user's id
   * @param itemId item's id
   */
  async deleteOne(creator: Member, item: Item): Promise<ItemLike> {
    const deleteResult = await this.createQueryBuilder()
      .delete()
      .where('creator = :creatorId', { creatorId: creator.id })
      .andWhere('item = :itemId', { itemId: item.id })
      .returning('*')
      .execute();

    // TODO
    if (!deleteResult.raw.length) {
      throw new ItemLikeNotFound({ creatorId: creator.id, itemId: item.id });
    }

    return deleteResult.raw[0].id;
  },
});
