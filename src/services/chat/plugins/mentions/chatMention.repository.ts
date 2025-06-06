import { eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { MentionStatus } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { chatMentionsTable } from '../../../../drizzle/schema';
import type { ChatMentionRaw, ChatMentionWithMessageAndCreator } from '../../../../drizzle/types';
import { ChatMentionNotFound, NoChatMentionForMember } from '../../errors';

@singleton()
export class ChatMentionRepository {
  /**
   * Retrieves all the mentions for the given accountId
   * @param accountId Id of the account to retrieve
   */
  async getForAccount(
    dbConnection: DBConnection,
    accountId: string,
  ): Promise<ChatMentionWithMessageAndCreator[]> {
    if (!accountId) {
      throw new NoChatMentionForMember({ accountId });
    }

    const res = await dbConnection.query.chatMentionsTable.findMany({
      where: eq(chatMentionsTable.accountId, accountId),
      with: {
        message: true,
        account: true,
      },
    });
    return res;
  }

  /**
   * Retrieves a mention given the mention id
   * @param mentionId Id of the mention to retrieve
   */
  async get(dbConnection: DBConnection, mentionId: string): Promise<ChatMentionRaw> {
    if (!mentionId) {
      throw new ChatMentionNotFound(mentionId);
    }

    const mention = await dbConnection.query.chatMentionsTable.findFirst({
      where: eq(chatMentionsTable.id, mentionId),
    });

    if (!mention) {
      throw new ChatMentionNotFound(mentionId);
    }

    return mention;
  }

  /**
   * Create many mentions for accounts
   * @param mentionedAccountIds Id of the mention to retrieve
   * @param messageId message id with the mentions
   * @param item
   */
  async postMany(
    dbConnection: DBConnection,
    mentionedAccountIds: string[],
    messageId: string,
  ): Promise<ChatMentionRaw[]> {
    const entries = mentionedAccountIds.map((accountId) => ({
      accountId: accountId,
      messageId: messageId,
      status: MentionStatus.Unread,
    }));
    return await dbConnection.insert(chatMentionsTable).values(entries).returning();
  }

  /**
   * Edit the status of a mention
   * @param mentionId Mention id to be updated
   * @param status new status to be set
   */
  async patch(
    dbConnection: DBConnection,
    mentionId: string,
    status: MentionStatus,
  ): Promise<ChatMentionRaw> {
    const res = await dbConnection
      .update(chatMentionsTable)
      .set({ status })
      .where(eq(chatMentionsTable.id, mentionId))
      .returning();

    if (res.length !== 1) {
      throw new ChatMentionNotFound(mentionId);
    }
    return res[0];
  }

  /**
   * Remove a mention
   * @param mentionId Id of chat
   */
  async deleteOne(dbConnection: DBConnection, mentionId: string): Promise<ChatMentionRaw> {
    const res = await dbConnection
      .delete(chatMentionsTable)
      .where(eq(chatMentionsTable.id, mentionId))
      .returning();
    if (res.length !== 1) {
      throw new ChatMentionNotFound(mentionId);
    }
    return res[0];
  }

  /**
   * Remove all mentions for the given accountId
   * @param accountId Id of the account
   */
  async deleteAll(dbConnection: DBConnection, accountId: string): Promise<void> {
    await dbConnection.delete(chatMentionsTable).where(eq(chatMentionsTable.accountId, accountId));
  }
}
