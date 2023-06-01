import { MentionStatus } from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource';
import { Item } from '../../../item/entities/Item';
import { ChatMessage } from '../../chatMessage';
import { ChatMentionNotFound } from '../../errors';
import { ChatMention } from './chatMention';

// TODO: finish to refactor this
export const ChatMentionRepository = AppDataSource.getRepository(ChatMention).extend({
  /**
   * Retrieves all the mentions for the given memberId
   * @param memberId Id of the member to retrieve
   */
  async getForMember(memberId: string): Promise<ChatMention[]> {
    return this.find({
      where: { member: { id: memberId } },
      relations: ['message', 'message.item', 'message.creator', 'member'],
    });
  },

  /**
   * Retrieves a mention given the mention id
   * @param mentionId Id of the mention to retrieve
   */
  async get(mentionId: string): Promise<ChatMention> {
    const mention = await this.findOne({ where: { id: mentionId }, relations: { member: true } });

    if (!mention) {
      throw new ChatMentionNotFound(mentionId);
    }

    return mention;
  },

  // /**
  //  * Retrieves all mentions having the itemPath or being children of the itemPath
  //  * @param itemPath Id of the mention to retrieve
  //  */
  // async getForItem(
  //   item: Item,
  // ): Promise<ChatMention[]> {
  //   return transactionHandler
  //     .query<ChatMention>(
  //       sql`
  //           SELECT ${MentionService.allColumns}
  //           FROM ${MentionService.tableName}
  //           WHERE item_path <@ ${itemPath}
  //       `,
  //     )
  //     .then(({ rows }) => rows.slice(0));
  // }
  // /**
  //  * Retrieves all mentions having the messageId
  //  * @param messageId Id of the message
  //  */
  // async getMentionsByMessageId(
  //   messageId: string,
  //   transactionHandler: TrxHandler,
  // ): Promise<ChatMention[]> {
  //   return transactionHandler
  //     .query<ChatMention>(
  //       sql`
  //           SELECT ${MentionService.allColumns}
  //           FROM ${MentionService.tableName}
  //           WHERE message_id = ${messageId}
  //       `,
  //     )
  //     .then(({ rows }) => rows.slice(0));
  // }
  // /**
  //  * Adds mentions for the chat message
  //  * @param mentions Array of memberIds that are mentioned
  //  * @param itemPath path of the item
  //  * @param messageId id of the chat message where the mention occurs
  //  * @param creator user creating the message and creating the mentions
  //  */
  async postMany(
    mentionedMembers: string[],
    message: ChatMessage,
    item: Item,
  ): Promise<ChatMention[]> {
    const entries = this.create(
      mentionedMembers.map((member) => ({
        member: { id: member },
        item,
        message,
        status: MentionStatus.Unread,
      })),
    );
    await this.insert(entries);
    return entries;
  },

  /**
   * Edit the status of a mention
   * @param mentionId Mention id to be updated
   * @param status new status to be set
   */
  async patch(mentionId: string, status: MentionStatus): Promise<ChatMention> {
    await this.update(mentionId, { status });
    return this.get(mentionId);
  },

  /**
   * Remove a mention
   * @param mentionId Id of chat
   */
  async deleteOne(mentionId: string): Promise<ChatMention> {
    return this.delete(mentionId);
  },

  /**
   * Remove all mentions for the given memberId
   * @param memberId Id of the member
   */
  async deleteAll(memberId: string): Promise<unknown> {
    return this.createQueryBuilder('mention')
      .leftJoinAndSelect('mention.member', 'member')
      .delete()
      .where('member.id = :memberId', { memberId })
      .execute();
  },
});
