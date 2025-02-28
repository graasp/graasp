import { eq, inArray } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { MentionStatus } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { chatMentionsTable } from '../../../../drizzle/schema';
import { ChatMentionWithMessageAndCreator } from '../../../../drizzle/types';
import { Account } from '../../../account/entities/account';
import { ChatMentionNotFound, NoChatMentionForMember } from '../../errors';

@singleton()
export class ChatMentionRepository {
  /**
   * Retrieves all the mentions for the given accountId
   * @param accountId Id of the account to retrieve
   */
  async getForAccount(
    db: DBConnection,
    accountId: string,
  ): Promise<ChatMentionWithMessageAndCreator[]> {
    if (!accountId) {
      throw new NoChatMentionForMember({ accountId });
    }

    const res = await db.query.chatMentionsTable.findMany({
      with: {
        chatMessage: true,
        account: true,
      },
    });
    return res;
  }

  /**
   * Retrieves a mention given the mention id
   * @param mentionId Id of the mention to retrieve
   */
  async get(db: DBConnection, mentionId: string): Promise<ChatMention> {
    if (!mentionId) {
      throw new ChatMentionNotFound(mentionId);
    }

    const mention = await db.query.chatMentionsTable.findFirst({
      where: eq(chatMentionsTable.id, mentionId),
      with: { account: true },
    });

    if (!mention) {
      throw new ChatMentionNotFound(mentionId);
    }

    return mention;
  }

  /**
   * Return chat mentions by id
   * @param ids ids of the chat mentions
   */
  async getMany(
    db: DBConnection,
    ids: ChatMessage['id'][],
  ): Promise<ChatMention[]> {
    return await db.query.chatMentionsTable.findMany({
      where: inArray(chatMentionsTable.id, ids),
      with: { account: true },
    });
  }

  /**
   * Create many mentions for accounts
   * @param mentionedAccountIds Id of the mention to retrieve
   * @param messageId message id with the mentions
   * @param item
   */
  async postMany(
    db: DBConnection,
    mentionedAccountIds: (typeof Account.prototype.id)[],
    messageId: typeof ChatMessage.prototype.id,
  ): Promise<ChatMention[]> {
    const entries = mentionedAccountIds.map((accountId) => ({
      account: { id: accountId },
      message: { id: messageId },
      status: MentionStatus.Unread,
    }));
    return await db.insert(chatMentionsTable).values(entries).returning();
  }

  /**
   * Edit the status of a mention
   * @param mentionId Mention id to be updated
   * @param status new status to be set
   */
  async patch(
    db: DBConnection,
    mentionId: string,
    status: MentionStatus,
  ): Promise<ChatMention> {
    return await db
      .update(chatMentionsTable)
      .set({ status })
      .where(eq(chatMentionsTable.id, mentionId))
      .returning();
  }

  /**
   * Remove a mention
   * @param mentionId Id of chat
   */
  async deleteOne(
    db: DBConnection,
    mentionId: ChatMention['id'],
  ): Promise<ChatMention> {
    await db
      .delete(chatMentionsTable)
      .where(eq(chatMentionsTable.id, mentionId))
      .returning();
  }

  /**
   * Remove all mentions for the given accountId
   * @param accountId Id of the account
   */
  async deleteAll(db: DBConnection, accountId: string): Promise<void> {
    await db
      .delete(chatMentionsTable)
      .where(eq(chatMentionsTable.accountId, accountId));
  }
}
