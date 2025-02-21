import { eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../../drizzle/db';
import { ItemBookmark, item, itemBookmark } from '../../../../../drizzle/schema';
import { assertIsError } from '../../../../../utils/assertions';
import { isDuplicateEntryError } from '../../../../../utils/typeormError';
import { MemberIdentifierNotFound } from '../../../../itemLogin/errors';
import { itemFavoriteSchema } from '../../../../member/plugins/export-data/schemas/schemas';
import { schemaToSelectMapper } from '../../../../member/plugins/export-data/utils/selection.utils';
import { Item } from '../../../entities/Item';
import { DuplicateBookmarkError, ItemBookmarkNotFound } from '../errors';

@singleton()
export class ItemBookmarkRepository {
  async get(db: DBConnection, bookmarkId: string): Promise<ItemBookmark> {
    if (!bookmarkId) {
      throw new ItemBookmarkNotFound(bookmarkId);
    }
    const favorite = await db.query.itemBookmark.findFirst({
      where: eq(itemBookmark.id, bookmarkId),
      with: { item: true, account: true },
    });

    if (!favorite) {
      throw new ItemBookmarkNotFound(bookmarkId);
    }
    return favorite;
  }

  /**
   * Get favorite items by given memberId.
   * @param memberId user's id
   */
  async getFavoriteForMember(db: DBConnection, memberId: string): Promise<(ItemBookmark & Item)[]> {
    const bookmarks = await db
      .select()
      .from(itemBookmark)
      .innerJoin(item, eq(itemBookmark.itemId, item.id))
      .where(eq(itemBookmark.memberId, memberId));
    const bookmarksResult = bookmarks.map(({ item_favorite, item_view }) => ({
      ...item_favorite,
      item: item_view,
    }));
    return bookmarksResult;
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
      assertIsError(e);
      if (isDuplicateEntryError(e)) {
        throw new DuplicateBookmarkError({ itemId, memberId });
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
