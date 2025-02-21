import { and, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../drizzle/db';
import { Account, Item, ItemLike, itemLikes } from '../../../../drizzle/schema';
import { itemLikeSchema } from '../../../member/plugins/export-data/schemas/schemas';
import { schemaToSelectMapper } from '../../../member/plugins/export-data/utils/selection.utils';
import { ItemLikeNotFound } from './errors';

type CreatorId = ItemLike['creatorId'];
type ItemId = ItemLike['itemId'];
type CreateItemLikeBody = { creatorId: CreatorId; itemId: ItemId };

type ItemLikeWithRelations = ItemLike & { item: Item; creator: Account };

@singleton()
export class ItemLikeRepository {
  /**
   * create an item like
   * @param memberId user's id
   * @param itemId item's id
   */
  async addOne(db: DBConnection, { creatorId, itemId }: CreateItemLikeBody): Promise<ItemLike> {
    const result = await db.insert(itemLikes).values({ itemId, creatorId }).returning();
    if (result.length != 1) {
      throw new Error('Expected to receive, created item, but did not get it.');
    }
    return result[0];
  }

  async getOne(db: DBConnection, id: string): Promise<ItemLikeWithRelations> {
    const result = await db.query.itemLikes.findFirst({
      where: eq(itemLikes.id, id),
      with: { item: true, creator: true },
    });
    if (!result) {
      throw new Error('Could not find expected item like');
    }
    return result;
  }

  /**
   * Get item likes by given memberId.
   * @param creatorId user's id
   */
  async getByCreator(db: DBConnection, creatorId: CreatorId): Promise<ItemLikeWithRelations[]> {
    if (!creatorId) {
      throw new Error('creator Id is not defined');
    }
    const result = await db.query.itemLikes.findMany({
      where: eq(itemLikes.creatorId, creatorId),
      with: { item: true, creator: true },
    });
    return result;
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
  async getByItemId(itemId: ItemId): Promise<ItemLike[]> {
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
  async getCountByItemId(itemId: ItemId): Promise<number> {
    this.throwsIfParamIsInvalid('itemId', itemId);
    return await this.repository
      .createQueryBuilder('itemLike')
      .where('itemLike.item_id = :itemId', { itemId })
      .getCount();
  }

  /**
   * delete an item like
   * @param creatorId user's id
   * @param itemId item's id
   */
  async deleteOneByCreatorAndItem(
    db: DBConnection,
    creatorId: CreatorId,
    itemId: ItemId,
  ): Promise<ItemLike> {
    const result = await db
      .delete(itemLikes)
      .where(and(eq(itemLikes.itemId, itemId), eq(itemLikes.creatorId, creatorId)))
      .returning();

    if (result.length != 1) {
      throw new ItemLikeNotFound({ creatorId, itemId });
    }

    return result[0];
  }
}
