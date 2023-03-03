import { AppDataSource } from '../../plugins/datasource';
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
      relations: { creator: true },
      order: { createdAt: 'ASC' },
    });
  },

  /**
   * Retrieves a message by its id
   * @param id Id of the message to retrieve
   */
  async get(id: string, options = { shouldExist: false }): Promise<ChatMessage> {
    const chatMessage = await this.findOne({ where: { id }, relations: { creator: true } });

    if (options.shouldExist && !chatMessage) {
      throw new ChatMessageNotFound(id);
    }

    return chatMessage;
  },

  /**
   * Adds a message to the given chat
   * @param message Message
   */
  async postOne(message: { chatId: string; creator: string; body: string }): Promise<ChatMessage> {
    const entry = this.create({ ...message, item: message.chatId });
    await this.insert(entry);
    return entry;
  },

  /**
   * Edit a message of the given chat
   * @param id message id to edit
   * @param data data for the message to edit
   */
  async patchOne(id: string, data: Partial<ChatMessage>): Promise<ChatMessage> {
    await this.update(id, data);
    // TODO: optimize
    return this.get(id);
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
  async clearChat(chatId: string): Promise<ChatMessage[]> {
    return this.delete({ item: { id: chatId } });
  },
});
