import { EntityManager, In, Repository } from 'typeorm';

import { MentionStatus } from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource';
import { Member } from '../../../member/entities/member';
import { selectChatMentions } from '../../../member/plugins/data/schemas/selects';
import { ChatMessage } from '../../chatMessage';
import { ChatMentionNotFound, NoChatMentionForMember } from '../../errors';
import { ChatMention } from './chatMention';

export class ChatMentionRepository {
  repository: Repository<ChatMention>;

  constructor(manager?: EntityManager) {
    if (manager) {
      this.repository = manager.getRepository(ChatMention);
    } else {
      this.repository = AppDataSource.getRepository(ChatMention);
    }
  }

  /**
   * Retrieves all the mentions for the given memberId
   * @param memberId Id of the member to retrieve
   */
  async getForMember(memberId: string): Promise<ChatMention[]> {
    if (!memberId) {
      throw new NoChatMentionForMember({ memberId });
    }

    return this.repository.find({
      where: { member: { id: memberId } },
      relations: {
        message: { item: true, creator: true },
        member: true,
      },
    });
  }

  /**
   * Return all the chat mentions for the given member.
   * @param memberId ID of the member to retrieve the data.
   * @returns an array of the chat mentions.
   */
  async getForMemberExport(memberId: string): Promise<ChatMention[]> {
    if (!memberId) {
      throw new NoChatMentionForMember({ memberId });
    }

    return this.repository.find({
      select: selectChatMentions,
      where: { member: { id: memberId } },
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
      relations: { member: true },
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
      relations: { member: true },
    });

    return items;
  }

  /**
   * Create many mentions for members
   * @param mentionedMemberIds Id of the mention to retrieve
   * @param messageId message id with the mentions
   * @param item
   */
  async postMany(
    mentionedMemberIds: Member['id'][],
    messageId: ChatMessage['id'],
  ): Promise<ChatMention[]> {
    const entries = mentionedMemberIds.map((memberId) => ({
      member: { id: memberId },
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
   * Remove all mentions for the given memberId
   * @param memberId Id of the member
   */
  async deleteAll(memberId: string): Promise<void> {
    await this.repository
      .createQueryBuilder('mention')
      .leftJoinAndSelect('mention.member', 'member')
      .delete()
      .where('member.id = :memberId', { memberId })
      .execute();
  }
}
