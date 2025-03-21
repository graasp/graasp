import { and, desc, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../drizzle/db';
import { itemBookmarks, items, membersView } from '../../../../drizzle/schema';
import {
  Item,
  ItemBookmarkInsertDTO,
  ItemBookmarkRawWithItemAndAccount,
  ItemBookmarkRawWithItemWithCreator,
  MemberRaw,
} from '../../../../drizzle/types';
import { MemberIdentifierNotFound } from '../../../itemLogin/errors';
import { DuplicateBookmarkError, ItemBookmarkNotFound } from './errors';

@singleton()
export class ItemBookmarkRepository {
  async get(db: DBConnection, bookmarkId: string): Promise<ItemBookmarkRawWithItemAndAccount> {
    if (!bookmarkId) {
      throw new ItemBookmarkNotFound(bookmarkId);
    }
    const bookmark = await db.query.itemBookmarks.findFirst({
      where: eq(itemBookmarks.id, bookmarkId),
      with: { item: true, account: true },
    });

    if (!bookmark) {
      throw new ItemBookmarkNotFound(bookmarkId);
    }
    return bookmark;
  }

  /**
   * Get bookmark items by given memberId.
   * @param memberId user's id
   */
  async getBookmarksForMember(
    db: DBConnection,
    memberId: string,
  ): Promise<ItemBookmarkRawWithItemWithCreator[]> {
    const bookmarks = await db
      .select()
      .from(itemBookmarks)
      .innerJoin(items, eq(itemBookmarks.itemId, items.id))
      .leftJoin(membersView, eq(items.creatorId, membersView.id))
      .where(eq(itemBookmarks.memberId, memberId));

    const bookmarksResult = bookmarks.map(({ item_favorite, item_view, members_view }) => ({
      ...item_favorite,
      item: { ...item_view, creator: members_view as MemberRaw | null },
    }));
    return bookmarksResult;
  }

  /**
   * Return all the bookmark items of the given member.
   * @param memberId ID of the member to retrieve the data.
   * @returns an array of favorites.
   */
  async getForMemberExport(
    db: DBConnection,
    memberId: string,
  ): Promise<
    {
      id: string;
      createdAt: string;
      itemId: string;
    }[]
  > {
    if (!memberId) {
      throw new MemberIdentifierNotFound();
    }
    const result = await db.query.itemBookmarks.findMany({
      columns: { id: true, createdAt: true, itemId: true },
      where: eq(itemBookmarks.memberId, memberId),
      orderBy: desc(itemBookmarks.createdAt),
    });

    return result;
  }

  async post(db: DBConnection, itemId: string, memberId: string): Promise<ItemBookmarkInsertDTO> {
    const createdBookmark = await db
      .insert(itemBookmarks)
      .values({ itemId, memberId })
      .returning()
      .onConflictDoNothing();
    if (createdBookmark.length === 0) {
      throw new DuplicateBookmarkError({ itemId, memberId });
    }

    return createdBookmark[0];
  }

  async deleteOne(db: DBConnection, itemId: string, memberId: string): Promise<Item['id']> {
    await db
      .delete(itemBookmarks)
      .where(and(eq(itemBookmarks.itemId, itemId), eq(itemBookmarks.memberId, memberId)));

    return itemId;
  }
}
