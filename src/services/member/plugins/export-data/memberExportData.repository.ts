import { or } from 'drizzle-orm';
import { desc, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../drizzle/db';
import {
  actionsTable,
  appActionsTable,
  appDataTable,
  appSettingsTable,
  chatMentionsTable,
  chatMessagesTable,
  itemBookmarksTable,
  itemLikesTable,
  itemMembershipsTable,
  itemsRawTable,
} from '../../../../drizzle/schema';
import {
  ActionRaw,
  AppActionRaw,
  AppDataRaw,
  AppSettingRaw,
  ChatMentionWithMessageWithoutCreator,
  ChatMessageRaw,
  Item,
  ItemLikeWithItem,
  ItemMembershipRaw,
} from '../../../../drizzle/types';
import { IllegalArgumentException } from '../../../../repositories/errors';
import { throwsIfParamIsInvalid } from '../../../../repositories/utils';
import { NoChatMentionForMember } from '../../../chat/errors';
import { MemberIdentifierNotFound } from '../../../itemLogin/errors';

@singleton()
export class ExportDataRepository {
  constructor() {}

  /**
   * Return all the items where the creator is the given actor.
   * It even returns the item if the actor is the creator but without permissions on it !
   *
   * @param memberId The creator of the items.
   * @returns an array of items created by the actor.
   */
  async getItems(db: DBConnection, memberId: string): Promise<Item[]> {
    if (!memberId) {
      throw new MemberIdentifierNotFound();
    }

    return db.query.itemsRawTable.findMany({
      where: eq(itemsRawTable.creatorId, memberId),
      orderBy: desc(itemsRawTable.updatedAt),
    });
  }

  /**
   * Return all the memberships related to the given account.
   * @param accountId ID of the account to retrieve the data.
   * @returns an array of memberships.
   */
  async getItemMemberships(db: DBConnection, accountId: string): Promise<ItemMembershipRaw[]> {
    if (!accountId) {
      throw new MemberIdentifierNotFound();
    }

    return await db.query.itemMembershipsTable.findMany({
      where: or(
        eq(itemMembershipsTable.accountId, accountId),
        eq(itemMembershipsTable.creatorId, accountId),
      ),
      orderBy: desc(itemMembershipsTable.updatedAt),
    });
  }

  /**
   * Return all the chat mentions for the given account.
   * @param accountId ID of the account to retrieve the data.
   * @returns an array of the chat mentions.
   */
  async getChatMentions(
    db: DBConnection,
    accountId: string,
  ): Promise<ChatMentionWithMessageWithoutCreator[]> {
    if (!accountId) {
      throw new NoChatMentionForMember({ accountId });
    }

    return await db.query.chatMentionsTable.findMany({
      where: eq(chatMentionsTable.accountId, accountId),
      orderBy: desc(chatMentionsTable.createdAt),
      with: {
        message: { columns: { creatorId: false } },
      },
    });
  }

  /**
   * Return all the messages related to the given member.
   * @param memberId ID of the member to retrieve the data.
   * @returns an array of the messages.
   */
  async getChatMessages(
    db: DBConnection,
    memberId: string,
  ): Promise<Omit<ChatMessageRaw, 'creatorId'>[]> {
    throwsIfParamIsInvalid('memberId', memberId);

    return await db.query.chatMessagesTable.findMany({
      columns: { creatorId: false },
      where: eq(chatMessagesTable.creatorId, memberId),
      orderBy: desc(chatMessagesTable.createdAt),
    });
  }

  /**
   * Return all the actions generated by the given account.
   * @param accountId ID of the account to retrieve the data.
   * @returns an array of actions generated by the account.
   */
  async getActions(
    db: DBConnection,
    accountId: string,
  ): Promise<Pick<ActionRaw, 'id' | 'type' | 'itemId' | 'view' | 'createdAt' | 'extra'>[]> {
    if (!accountId) {
      throw new MemberIdentifierNotFound();
    }

    return await db.query.actionsTable.findMany({
      columns: { id: true, view: true, type: true, extra: true, createdAt: true, itemId: true },
      where: eq(actionsTable.accountId, accountId),
      orderBy: desc(actionsTable.createdAt),
    });
  }

  /**
   * Return all the app actions generated by the given account.
   * @param accountId ID of the account to retrieve the data.
   * @returns an array of app actions generated by the account.
   */
  async getAppActions(
    db: DBConnection,
    accountId: string,
  ): Promise<Pick<AppActionRaw, 'id' | 'type' | 'itemId' | 'createdAt' | 'data'>[]> {
    if (!accountId) {
      throw new IllegalArgumentException('The accountId must be defined');
    }

    return await db.query.appActionsTable.findMany({
      columns: { id: true, type: true, data: true, createdAt: true, itemId: true },
      where: eq(appActionsTable.accountId, accountId),
      orderBy: desc(appActionsTable.createdAt),
    });
  }

  /**
   * Return all the app data generated by the given account.
   * @param accountId ID of the account to retrieve the data.
   * @returns an array of app data generated by the account.
   */
  async getAppData(db: DBConnection, accountId: string): Promise<AppDataRaw[]> {
    if (!accountId) {
      throw new IllegalArgumentException('The accountId must be defined');
    }

    return await db.query.appDataTable.findMany({
      where: or(eq(appDataTable.accountId, accountId), eq(appDataTable.creatorId, accountId)),
      orderBy: desc(appDataTable.createdAt),
    });
  }
  /**
   * Return all the app settings generated by the given member.
   * @param memberId ID of the member to retrieve the data.
   * @returns an array of app settings generated by the member.
   */
  async getAppSettings(
    db: DBConnection,
    memberId: string,
  ): Promise<Omit<AppSettingRaw, 'creatorId'>[]> {
    if (!memberId) {
      throw new MemberIdentifierNotFound();
    }

    return await db.query.appSettingsTable.findMany({
      columns: { creatorId: false },
      where: eq(appSettingsTable.creatorId, memberId),
      orderBy: desc(appSettingsTable.createdAt),
    });
  }

  /**
   * Return all the favorite items of the given member.
   * @param memberId ID of the member to retrieve the data.
   * @returns an array of favorites.
   */
  async getItemBookmarks(
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
    const result = await db.query.itemBookmarksTable.findMany({
      columns: { id: true, createdAt: true, itemId: true },
      where: eq(itemBookmarksTable.memberId, memberId),
      orderBy: desc(itemBookmarksTable.createdAt),
    });

    return result;
  }
  /**
   * Return all the liked item references of the given member.
   * @param memberId ID of the member to retrieve the data.
   * @returns an array of favorites.
   */
  async getItemLikes(
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
    const result = await db.query.itemLikesTable.findMany({
      columns: { id: true, createdAt: true, itemId: true },
      where: eq(itemLikesTable.creatorId, memberId),
      orderBy: desc(itemLikesTable.createdAt),
    });

    return result;
  }

  /**
   * Return all the likes created by the given member.
   * @param creatorId ID of the member to retrieve the data.
   * @returns an array of item likes.
   */
  async getByCreatorToExport(db: DBConnection, creatorId: string): Promise<ItemLikeWithItem[]> {
    throwsIfParamIsInvalid('creatorId', creatorId);

    return await db.query.itemLikesTable.findMany({
      where: eq(itemLikesTable.creatorId, creatorId),
      orderBy: desc(itemLikesTable.createdAt),
      with: {
        item: true,
      },
    });
  }
}
