import { and, desc, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { type DBConnection } from '../../../../drizzle/db';
import { itemBookmarksTable, items, membersView } from '../../../../drizzle/schema';
import type {
  ItemBookmarkInsertDTO,
  ItemBookmarkRawWithItemAndAccount,
  ItemBookmarkRawWithItemWithCreator,
  ItemRaw,
  MemberRaw,
} from '../../../../drizzle/types';
import { MemberIdentifierNotFound } from '../../../itemLogin/errors';
import { DuplicateBookmarkError, ItemBookmarkNotFound } from './errors';

@singleton()
export class ItemBookmarkRepository {
  async get(
    dbConnection: DBConnection,
    bookmarkId: string,
  ): Promise<ItemBookmarkRawWithItemAndAccount> {
    if (!bookmarkId) {
      throw new ItemBookmarkNotFound(bookmarkId);
    }
    const bookmark = await dbConnection.query.itemBookmarksTable.findFirst({
      where: eq(itemBookmarksTable.id, bookmarkId),
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
    dbConnection: DBConnection,
    memberId: string,
  ): Promise<ItemBookmarkRawWithItemWithCreator[]> {
    const bookmarks = await dbConnection
      .select()
      .from(itemBookmarksTable)
      .innerJoin(items, eq(itemBookmarksTable.itemId, items.id))
      .leftJoin(membersView, eq(items.creatorId, membersView.id))
      .where(eq(itemBookmarksTable.memberId, memberId));

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
    dbConnection: DBConnection,
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
    const result = await dbConnection.query.itemBookmarksTable.findMany({
      columns: { id: true, createdAt: true, itemId: true },
      where: eq(itemBookmarksTable.memberId, memberId),
      orderBy: desc(itemBookmarksTable.createdAt),
    });

    return result;
  }

  async post(
    dbConnection: DBConnection,
    itemId: string,
    memberId: string,
  ): Promise<ItemBookmarkInsertDTO> {
    const createdBookmark = await dbConnection
      .insert(itemBookmarksTable)
      .values({ itemId, memberId })
      .returning()
      .onConflictDoNothing();
    if (createdBookmark.length === 0) {
      throw new DuplicateBookmarkError({ itemId, memberId });
    }

    return createdBookmark[0];
  }

  async deleteOne(
    dbConnection: DBConnection,
    itemId: string,
    memberId: string,
  ): Promise<ItemRaw['id']> {
    await dbConnection
      .delete(itemBookmarksTable)
      .where(and(eq(itemBookmarksTable.itemId, itemId), eq(itemBookmarksTable.memberId, memberId)));

    return itemId;
  }
}
