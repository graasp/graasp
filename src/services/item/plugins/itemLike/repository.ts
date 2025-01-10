import { EntityManager } from 'typeorm';

import { MutableRepository } from '../../../../repositories/MutableRepository';
import { DEFAULT_PRIMARY_KEY } from '../../../../repositories/const';
import { itemLikeSchema } from '../../../member/plugins/export-data/schemas/schemas';
import { schemaToSelectMapper } from '../../../member/plugins/export-data/utils/selection.utils';
import { ItemLikeNotFound } from './errors';
import { ItemLike } from './itemLike';

type CreatorId = ItemLike['creator']['id'];
type ItemId = ItemLike['item']['id'];
type CreateItemLikeBody = { creatorId: CreatorId; itemId: ItemId };

export class ItemLikeRepository extends MutableRepository<ItemLike, never> {
  constructor(manager?: EntityManager) {
    super(DEFAULT_PRIMARY_KEY, ItemLike, manager);
  }

  /**
   * create an item like
   * @param memberId user's id
   * @param itemId item's id
   */
  async addOne({ creatorId, itemId }: CreateItemLikeBody): Promise<ItemLike> {
    return await super.insert({ item: { id: itemId }, creator: { id: creatorId } });
  }

  async getOne(id: string) {
    return await super.findOne(id, { relations: { item: true, creator: true } });
  }

  /**
   * Get item likes by given memberId.
   * @param creatorId user's id
   */
  async getByCreator(creatorId: CreatorId): Promise<ItemLike[]> {
    this.throwsIfParamIsInvalid('creatorId', creatorId);
    return await this.repository
      .createQueryBuilder('itemLike')
      .innerJoinAndSelect('itemLike.item', 'item')
      .innerJoinAndSelect('item.creator', 'member')
      .where('itemLike.creator = :creatorId', { creatorId })
      .getMany();
  }

  /**
   * Return all the likes created by the given member.
   * @param creatorId ID of the member to retrieve the data.
   * @returns an array of item likes.
   */
  async getByCreatorToExport(creatorId: CreatorId): Promise<ItemLike[]> {
    this.throwsIfParamIsInvalid('creatorId', creatorId);

    return await this.repository.find({
      select: schemaToSelectMapper(itemLikeSchema),
      where: { creator: { id: creatorId } },
      order: { createdAt: 'DESC' },
      relations: {
        item: true,
      },
    });
  }

  /**
   * Get likes for item
   * @param itemId
   */
  async getByItem(itemId: ItemId): Promise<ItemLike[]> {
    this.throwsIfParamIsInvalid('itemId', itemId);
    return await this.repository
      .createQueryBuilder('itemLike')
      .innerJoinAndSelect('itemLike.item', 'item')
      .where('itemLike.item = :itemId', { itemId })
      .getMany();
  }

  /**
   * Get likes count for item
   * @param itemId
   * @returns number of likes for item
   */
  async getCountForItemId(itemId: ItemId): Promise<number> {
    this.throwsIfParamIsInvalid('itemId', itemId);
    return await this.repository
      .createQueryBuilder('itemLike')
      .innerJoinAndSelect('itemLike.item', 'item')
      .where('itemLike.item = :itemId', { itemId })
      .getCount();
  }

  /**
   * delete an item like
   * @param creatorId user's id
   * @param itemId item's id
   */
  async deleteOneByCreatorAndItem(creatorId: CreatorId, itemId: ItemId): Promise<ItemLike> {
    this.throwsIfParamIsInvalid('creatorId', creatorId);
    this.throwsIfParamIsInvalid('itemId', itemId);

    const entity = await this.repository.findOne({
      where: {
        item: { id: itemId },
        creator: { id: creatorId },
      },
    });

    if (!entity) {
      throw new ItemLikeNotFound({ creatorId, itemId });
    }

    await super.delete(entity.id);

    return entity;
  }
}
