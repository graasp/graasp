import { and, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../drizzle/db';
import { itemLikes } from '../../../../drizzle/schema';
import {
  ItemLikeRaw,
  ItemLikeWithItem,
  ItemLikeWithItemAndAccount,
  ItemLikeWithItemWithCreator,
} from '../../../../drizzle/types';
import { IllegalArgumentException } from '../../../../repositories/errors';
import { ItemLikeNotFound } from './utils/errors';

type CreatorId = ItemLikeRaw['creatorId'];
type ItemId = ItemLikeRaw['itemId'];
type CreateItemLikeBody = { creatorId: CreatorId; itemId: ItemId };

@singleton()
export class ItemLikeRepository {
  protected throwsIfParamIsInvalid(name: string, value: string) {
    if (!value) {
      throw new IllegalArgumentException(`The given ${name} is undefined!`);
    }
  }

  /**
   * create an item like
   * @param memberId user's id
   * @param itemId item's id
   */
  async addOne(db: DBConnection, { creatorId, itemId }: CreateItemLikeBody): Promise<ItemLikeRaw> {
    const result = await db.insert(itemLikes).values({ itemId, creatorId }).returning();
    if (result.length != 1) {
      throw new Error('Expected to receive, created item, but did not get it.');
    }
    return result[0];
  }

  async getOne(db: DBConnection, id: string): Promise<ItemLikeWithItemAndAccount> {
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
  async getByCreator(
    db: DBConnection,
    creatorId: CreatorId,
  ): Promise<ItemLikeWithItemWithCreator[]> {
    if (!creatorId) {
      throw new Error('creator Id is not defined');
    }
    const result = await db.query.itemLikes.findMany({
      where: eq(itemLikes.creatorId, creatorId),
      with: { item: { with: { creator: true } } },
    });
    return result as ItemLikeWithItemWithCreator[];
  }

  /**
   * Get likes for item
   * @param itemId
   */
  async getByItemId(db: DBConnection, itemId: ItemId): Promise<ItemLikeWithItem[]> {
    this.throwsIfParamIsInvalid('itemId', itemId);
    const res = await db.query.itemLikes.findMany({
      where: eq(itemLikes.itemId, itemId),
      with: { item: true },
    });

    return res;
  }

  /**
   * Get likes count for item
   * @param itemId
   * @returns number of likes for item
   */
  async getCountByItemId(db: DBConnection, itemId: ItemId): Promise<number> {
    this.throwsIfParamIsInvalid('itemId', itemId);
    const res = await db.$count(itemLikes, eq(itemLikes.itemId, itemId));
    return res;
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
  ): Promise<ItemLikeRaw> {
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
