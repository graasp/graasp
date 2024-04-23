import { In } from 'typeorm';

import { ResultOf } from '@graasp/sdk';

import { AppDataSource } from '../../plugins/datasource';
import { MemberIdentifierNotFound } from '../itemLogin/errors';
import { Member } from '../member/entities/member';
import { messageSchema } from '../member/plugins/data/schemas/schemas';
import { schemaToSelectMapper } from '../member/plugins/data/utils/selection.utils';
import { mapById } from '../utils';
import { ChatMessage } from './chatMessage';
import { ChatMessageNotFound } from './errors';

export const ChatMessageRepository = AppDataSource.getRepository(ChatMessage).extend({
  /**
   * Retrieves all the messages related to the given item
   * @param itemId Id of item to retrieve messages for
   */
  async getForItem(itemId: string): Promise<ChatMessage[]> {
    return this.find({
      where: { item: { id: itemId } },
      relations: { creator: true, item: true },
      order: { createdAt: 'ASC' },
    });
  },

  /**
   * Retrieves all the messages related to the given items
   * @param itemIds Id of items to retrieve messages for
   */
  async getForItems(itemIds: string[]): Promise<ResultOf<ChatMessage[]>> {
    const messages = await this.find({
      where: { item: { id: In(itemIds) } },
      relations: { creator: true, item: true },
    });
    return mapById({
      keys: itemIds,
      findElement: (id) => messages.filter(({ item }) => item.id === id),
    });
  },

  /**
   * Return all the messages related to the given member.
   * @param memberId ID of the member to retrieve the data.
   * @returns an array of the messages.
   */
  async getForMemberExport(memberId: string): Promise<ChatMessage[]> {
    if (!memberId) {
      throw new MemberIdentifierNotFound();
    }

    return this.find({
      select: schemaToSelectMapper(messageSchema),
      where: { creator: { id: memberId } },
      order: { createdAt: 'DESC' },
      relations: {
        item: true,
      },
    });
  },

  /**
   * Retrieves a message by its id
   * @param id Id of the message to retrieve
   */
  async get(
    id: string,
    args?: { shouldExist?: boolean; relations?: { creator?: boolean; item?: boolean } },
  ): Promise<ChatMessage> {
    const options = { shouldExist: false, relations: { item: true, creator: true }, ...args };
    const chatMessage = await this.findOne({ where: { id }, relations: options.relations });

    if (options.shouldExist && !chatMessage) {
      throw new ChatMessageNotFound(id);
    }

    return chatMessage;
  },

  /**
   * Adds a message to the given chat
   * @param message Message
   */
  async postOne(message: { itemId: string; creator: Member; body: string }): Promise<ChatMessage> {
    const entry = this.create({ ...message, item: message.itemId });
    const created = await this.insert(entry);
    // TODO: optimize
    return this.get(created.identifiers[0].id, { relations: { item: true, creator: true } });
  },

  /**
   * Edit a message of the given chat
   * @param id message id to edit
   * @param data data for the message to edit
   */
  async patchOne(id: string, data: Partial<ChatMessage>): Promise<ChatMessage> {
    await this.update(id, data);
    // TODO: optimize
    return this.get(id, { relations: { item: true, creator: true } });
  },

  /**
   * Remove a message from the given chat
   * @param id Id of the message
   */
  async deleteOne(id: string): Promise<void> {
    await this.delete(id);
  },

  /**
   * Remove all messages for the given chat
   * @param chatId Id of chat
   */
  async clearChat(itemId: string): Promise<ChatMessage[]> {
    return this.delete({ item: { id: itemId } });
  },
});
