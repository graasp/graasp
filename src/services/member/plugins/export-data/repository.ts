import { getTableColumns, or } from 'drizzle-orm';
import { desc, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../drizzle/db';
import {
  actionsTable,
  appActions,
  appDatas,
  appSettings,
  chatMentionsTable,
  chatMessagesTable,
  itemBookmarks,
  itemLikes,
  itemMemberships,
  itemsRaw,
} from '../../../../drizzle/schema';
import {
  ActionRaw,
  AppActionRaw,
  AppDataRaw,
  AppSettingRaw,
  ChatMentionRaw,
  ChatMentionWithMessage,
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

    return db.query.itemsRaw.findMany({
      where: eq(itemsRaw.creatorId, memberId),
      orderBy: desc(itemsRaw.updatedAt),
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

    return await db.query.itemMemberships.findMany({
      where: or(eq(itemMemberships.accountId, accountId), eq(itemMemberships.creatorId, accountId)),
      orderBy: desc(itemMemberships.updatedAt),
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

    return await db.query.appActions.findMany({
      columns: { id: true, type: true, data: true, createdAt: true, itemId: true },
      where: eq(appActions.accountId, accountId),
      orderBy: desc(appActions.createdAt),
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

    return await db.query.appDatas.findMany({
      where: or(eq(appDatas.accountId, accountId), eq(appDatas.creatorId, accountId)),
      orderBy: desc(appDatas.createdAt),
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

    return await db.query.appSettings.findMany({
      columns: { creatorId: false },
      where: eq(appSettings.creatorId, memberId),
      orderBy: desc(appSettings.createdAt),
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
    const result = await db.query.itemBookmarks.findMany({
      columns: { id: true, createdAt: true, itemId: true },
      where: eq(itemBookmarks.memberId, memberId),
      orderBy: desc(itemBookmarks.createdAt),
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
    const result = await db.query.itemLikes.findMany({
      columns: { id: true, createdAt: true, itemId: true },
      where: eq(itemLikes.creatorId, memberId),
      orderBy: desc(itemLikes.createdAt),
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

    return await db.query.itemLikes.findMany({
      where: eq(itemLikes.creatorId, creatorId),
      orderBy: desc(itemLikes.createdAt),
      with: {
        item: true,
      },
    });
  }
}
