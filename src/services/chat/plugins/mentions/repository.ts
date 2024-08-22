import { EntityManager, In } from 'typeorm';

import { MentionStatus } from '@graasp/sdk';

import { AbstractRepository } from '../../../../repositories/AbstractRepository';
import { Account } from '../../../account/entities/account';
import { messageMentionSchema } from '../../../member/plugins/export-data/schemas/schemas';
import { schemaToSelectMapper } from '../../../member/plugins/export-data/utils/selection.utils';
import { ChatMessage } from '../../chatMessage';
import { ChatMentionNotFound, NoChatMentionForMember } from '../../errors';
import { ChatMention } from './chatMention';

export class ChatMentionRepository extends AbstractRepository<ChatMention> {
  constructor(manager?: EntityManager) {
    super(ChatMention, manager);
  }

  /**
   * Retrieves all the mentions for the given accountId
   * @param accountId Id of the account to retrieve
   */
  async getForAccount(accountId: string): Promise<ChatMention[]> {
    if (!accountId) {
      throw new NoChatMentionForMember({ accountId });
    }

    return this.repository.find({
      where: { account: { id: accountId } },
      relations: {
        message: { item: true, creator: true },
        account: true,
      },
    });
  }

  /**
   * Return all the chat mentions for the given account.
   * @param accountId ID of the account to retrieve the data.
   * @returns an array of the chat mentions.
   */
  async getForMemberExport(accountId: string): Promise<ChatMention[]> {
    if (!accountId) {
      throw new NoChatMentionForMember({ accountId });
    }

    return this.repository.find({
      select: schemaToSelectMapper(messageMentionSchema),
      where: { account: { id: accountId } },
      order: { createdAt: 'DESC' },
      relations: {
        message: {
          creator: true,
        },
      },
    });
  }

  /**
   * Retrieves a mention given the mention id
   * @param mentionId Id of the mention to retrieve
   */
  async get(mentionId: string): Promise<ChatMention> {
    if (!mentionId) {
      throw new ChatMentionNotFound(mentionId);
    }

    const mention = await this.repository.findOne({
      where: { id: mentionId },
      relations: { account: true },
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
  async getMany(ids: ChatMessage['id'][]): Promise<ChatMention[]> {
    const items = await this.repository.find({
      where: { id: In(ids) },
      relations: { account: true },
    });

    return items;
  }

  /**
   * Create many mentions for accounts
   * @param mentionedAccountIds Id of the mention to retrieve
   * @param messageId message id with the mentions
   * @param item
   */
  async postMany(
    mentionedAccountIds: (typeof Account.prototype.id)[],
    messageId: typeof ChatMessage.prototype.id,
  ): Promise<ChatMention[]> {
    const entries = mentionedAccountIds.map((accountId) => ({
      account: { id: accountId },
      message: { id: messageId },
      status: MentionStatus.Unread,
    }));
    const result = await this.repository.insert(entries);
    return this.getMany(result.identifiers.map(({ id }) => id));
  }

  /**
   * Edit the status of a mention
   * @param mentionId Mention id to be updated
   * @param status new status to be set
   */
  async patch(mentionId: string, status: MentionStatus): Promise<ChatMention> {
    await this.repository.update(mentionId, { status });
    return this.get(mentionId);
  }

  /**
   * Remove a mention
   * @param mentionId Id of chat
   */
  async deleteOne(mentionId: ChatMention['id']): Promise<ChatMention> {
    const mention = await this.get(mentionId);
    await this.repository.delete(mentionId);
    return mention;
  }

  /**
   * Remove all mentions for the given accountId
   * @param accountId Id of the account
   */
  async deleteAll(accountId: string): Promise<void> {
    await this.repository
      .createQueryBuilder('mention')
      .leftJoinAndSelect('mention.account', 'account')
      .delete()
      .where('account.id = :accountId', { accountId })
      .execute();
  }
}
