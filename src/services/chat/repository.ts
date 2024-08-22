import { EntityManager, In } from 'typeorm';

import { ResultOf } from '@graasp/sdk';

import { MutableRepository } from '../../repositories/MutableRepository';
import { DEFAULT_PRIMARY_KEY } from '../../repositories/const';
import { DeleteException } from '../../repositories/errors';
import { GetByItem, GetByItems, GetExportByMember } from '../../repositories/interfaces';
import { Member } from '../member/entities/member';
import { messageSchema } from '../member/plugins/export-data/schemas/schemas';
import { schemaToSelectMapper } from '../member/plugins/export-data/utils/selection.utils';
import { mapById } from '../utils';
import { ChatMessage } from './chatMessage';

// This type simplify the readability of the Repository's implements.
type IChatMessageRepository<T extends ChatMessage> = GetByItem<T> &
  GetByItems<T> &
  GetExportByMember<T>;

type ChatMessageUpdateBody = Partial<ChatMessage>;
type ChatMessageCreateBody = { itemId: string; creator: Member; body: string };

export class ChatMessageRepository
  extends MutableRepository<ChatMessage, ChatMessageUpdateBody>
  implements IChatMessageRepository<ChatMessage>
{
  constructor(manager?: EntityManager) {
    super(DEFAULT_PRIMARY_KEY, ChatMessage, manager);
  }

  /**
   * Retrieves all the messages related to the given item
   * @param itemId Id of item to retrieve messages for
   */
  async getByItem(itemId: string): Promise<ChatMessage[]> {
    this.throwsIfParamIsInvalid('itemId', itemId);

    return await this.repository.find({
      where: { item: { id: itemId } },
      relations: { creator: true, item: true },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Retrieves all the messages related to the given items
   * @param itemIds Id of items to retrieve messages for
   */
  async getByItems(itemIds: string[]): Promise<ResultOf<ChatMessage[]>> {
    this.throwsIfParamIsInvalid('itemIds', itemIds);

    const messages = await this.repository.find({
      where: { item: { id: In(itemIds) } },
      relations: { creator: true, item: true },
    });
    return mapById({
      keys: itemIds,
      findElement: (id) => messages.filter(({ item }) => item.id === id),
    });
  }

  /**
   * Return all the messages related to the given member.
   * @param memberId ID of the member to retrieve the data.
   * @returns an array of the messages.
   */
  async getExportByMember(memberId: string): Promise<ChatMessage[]> {
    this.throwsIfParamIsInvalid('memberId', memberId);

    return await this.repository.find({
      select: schemaToSelectMapper(messageSchema),
      where: { creator: { id: memberId } },
      order: { createdAt: 'DESC' },
      relations: {
        item: true,
      },
    });
  }

  /**
   * Retrieves a message by its id
   * @param id Id of the message to retrieve
   */
  async getOne(id: string) {
    return await this.findOne(id, { relations: { item: true, creator: true } });
  }

  /**
   * Adds a message to the given chat
   * @param message Message
   */
  async addOne(message: ChatMessageCreateBody): Promise<ChatMessage> {
    return await super.insert({ ...message, item: { id: message.itemId } });
  }

  /**
   * Edit a message of the given chat
   * @param id message id to edit
   * @param data data for the message to edit
   */
  async updateOne(id: string, data: ChatMessageUpdateBody): Promise<ChatMessage> {
    return await super.updateOne(id, data);
  }

  /**
   * Remove all messages for the item
   * @param itemId Id of item to clear the chat
   */
  async deleteByItem(itemId: string): Promise<ChatMessage[]> {
    this.throwsIfParamIsInvalid('itemId', itemId);

    const chats = await this.getByItem(itemId);

    if (chats.length === 0) {
      return [];
    }

    try {
      await this.repository.delete({ item: { id: itemId } });
      return chats;
    } catch (e) {
      throw new DeleteException(e);
    }
  }
}
