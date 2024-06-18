import { AppDataSource } from '../../../../plugins/datasource.js';
import { Item } from '../../../item/entities/Item.js';
import { MemberIdentifierNotFound } from '../../../itemLogin/errors.js';
import { Member } from '../../../member/entities/member.js';
import { itemLikeSchema } from '../../../member/plugins/export-data/schemas/schemas.js';
import { schemaToSelectMapper } from '../../../member/plugins/export-data/utils/selection.utils.js';
import { ItemLikeNotFound } from './errors.js';
import { ItemLike } from './itemLike.js';

export const ItemLikeRepository = AppDataSource.getRepository(ItemLike).extend({
  get(entryId: string) {
    // additional check that id is not null
    // o/w empty parameter to findOneBy return the first entry
    if (!entryId) {
      throw new ItemLikeNotFound(entryId);
    }
    return this.findOneBy({ id: entryId });
  },

  /**
   * Get item likes by given memberId.
   * @param memberId user's id
   */
  async getForMember(memberId: string): Promise<ItemLike[]> {
    const itemLikes = await this.createQueryBuilder('itemLike')
      .innerJoinAndSelect('itemLike.item', 'item')
      .innerJoinAndSelect('item.creator', 'member')
      .where('itemLike.creator = :memberId', { memberId })
      .getMany();
    return itemLikes;
  },

  /**
   * Return all the likes created by the given member.
   * @param memberId ID of the member to retrieve the data.
   * @returns an array of item likes.
   */
  async getForMemberExport(memberId: string): Promise<ItemLike[]> {
    if (!memberId) {
      throw new MemberIdentifierNotFound();
    }

    return this.find({
      select: schemaToSelectMapper(itemLikeSchema),
      where: { creator: { id: memberId } },
      order: { createdAt: 'DESC' },
      relations: {
        item: true,
      },
    });
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
