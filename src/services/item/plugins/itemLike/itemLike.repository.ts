import { sql } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { type DBConnection } from '../../../../drizzle/db';
import { itemLikesTable } from '../../../../drizzle/schema';
import type {
  ItemLikeRaw,
  ItemLikeWithItem,
  ItemLikeWithItemAndAccount,
  ItemLikeWithItemWithCreator,
} from '../../../../drizzle/types';
import { IllegalArgumentException } from '../../../../repositories/errors';
import { ItemLikeNotFound } from './itemLike.errors';

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
  async addOne(
    dbConnection: DBConnection,
    { creatorId, itemId }: CreateItemLikeBody,
  ): Promise<ItemLikeRaw> {
    const result = await dbConnection
      .insert(itemLikesTable)
      .values({ itemId, creatorId })
      .onConflictDoUpdate({
        target: [itemLikesTable.itemId, itemLikesTable.creatorId],
        set: { createdAt: sql.raw('DEFAULT') },
      })
      .returning();
    if (result.length != 1) {
      throw new Error('Expected to receive, created item, but did not get it.');
    }
    return result[0];
  }

  async getOne(dbConnection: DBConnection, id: string): Promise<ItemLikeWithItemAndAccount> {
    const result = await dbConnection.query.itemLikesTable.findFirst({
      where: eq(itemLikesTable.id, id),
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
    dbConnection: DBConnection,
    creatorId: CreatorId,
  ): Promise<ItemLikeWithItemWithCreator[]> {
    if (!creatorId) {
      throw new Error('creator Id is not defined');
    }
    const result = await dbConnection.query.itemLikesTable.findMany({
      where: eq(itemLikesTable.creatorId, creatorId),
      with: { item: { with: { creator: true } } },
    });
    return result as ItemLikeWithItemWithCreator[];
  }

  /**
   * Get likes for item
   * @param itemId
   */
  async getByItemId(dbConnection: DBConnection, itemId: ItemId): Promise<ItemLikeWithItem[]> {
    this.throwsIfParamIsInvalid('itemId', itemId);
    const res = await dbConnection.query.itemLikesTable.findMany({
      where: eq(itemLikesTable.itemId, itemId),
      with: { item: true },
    });

    return res;
  }

  /**
   * Get likes count for item
   * @param itemId
   * @returns number of likes for item
   */
  async getCountByItemId(dbConnection: DBConnection, itemId: ItemId): Promise<number> {
    this.throwsIfParamIsInvalid('itemId', itemId);
    const res = await dbConnection.$count(itemLikesTable, eq(itemLikesTable.itemId, itemId));
    return res;
  }

  /**
   * delete an item like
   * @param creatorId user's id
   * @param itemId item's id
   */
  async deleteOneByCreatorAndItem(
    dbConnection: DBConnection,
    creatorId: CreatorId,
    itemId: ItemId,
  ): Promise<ItemLikeRaw> {
    const result = await dbConnection
      .delete(itemLikesTable)
      .where(and(eq(itemLikesTable.itemId, itemId), eq(itemLikesTable.creatorId, creatorId)))
      .returning();

    if (result.length != 1) {
      throw new ItemLikeNotFound({ creatorId, itemId });
    }

    return result[0];
  }
}
