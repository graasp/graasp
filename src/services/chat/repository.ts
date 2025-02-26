import { asc, eq, inArray } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { ResultOf } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import { ChatMessageCreationDTO, chatMessages } from '../../drizzle/schema';
import { DeleteException, EntryNotFoundBeforeDeleteException } from '../../repositories/errors';
import { throwsIfParamIsInvalid } from '../../repositories/utils';
import { assertIsError } from '../../utils/assertions';
import { Guest } from '../itemLogin/entities/guest';
import { Member } from '../member/entities/member';
import { mapById } from '../utils';

type ChatMessageCreateBody = {
  itemId: string;
  creator: Guest | Member;
  body: string;
};

@singleton()
export class ChatMessageRepository {
  /**
   * Retrieves all the messages related to the given item
   * @param itemId Id of item to retrieve messages for
   */
  async getByItem(db: DBConnection, itemId: string): Promise<ChatMessage[]> {
    throwsIfParamIsInvalid('itemId', itemId);

    return await db.query.chatMessages.findMany({
      where: eq(chatMessages.itemId, itemId),
      with: { creator: true, item: true },
      orderBy: asc(chatMessages.createdAt),
    });
  }

  /**
   * Retrieves all the messages related to the given items
   * @param itemIds Id of items to retrieve messages for
   */
  async getByItems(db: DBConnection, itemIds: string[]): Promise<ResultOf<ChatMessage[]>> {
    throwsIfParamIsInvalid('itemIds', itemIds);

    const messages = await db.query.chatMessages.findMany({
      where: inArray(chatMessages.itemId, itemIds),
      with: { creator: true, item: true },
    });
    return mapById({
      keys: itemIds,
      findElement: (id) => messages.filter(({ item }) => item.id === id),
    });
  }

  /**
   * Retrieves a message by its id
   * @param id Id of the message to retrieve
   */
  async getOne(db: DBConnection, id: string) {
    return await db.query.chatMessages.findFirst({
      where: eq(chatMessages.id, id),
      with: { item: true, creator: true },
    });
  }

  /**
   * Adds a message to the given chat
   * @param message Message
   */
  async addOne(db: DBConnection, message: ChatMessageCreateBody): Promise<ChatMessage> {
    return await db.insert(chatMessages).values(message).returning();
  }

  /**
   * Edit a message of the given chat
   * @param id message id to edit
   * @param data data for the message to edit
   */
  async updateOne(
    db: DBConnection,
    id: string,
    data: ChatMessageCreationDTO,
  ): Promise<ChatMessage> {
    return await db.update(chatMessages).set(data).where(eq(chatMessages.id, id));
  }

  /*
   * Remove all messages for the item
   * @param itemId Id of item to clear the chat
   */
  async deleteByItem(db: DBConnection, itemId: string): Promise<ChatMessage[]> {
    throwsIfParamIsInvalid('itemId', itemId);

    const chats = await this.getByItem(db, itemId);

    if (chats.length === 0) {
      throw new EntryNotFoundBeforeDeleteException(this.entity);
    }

    try {
      await db.delete(chatMessages).where(eq(chatMessages.itemId, itemId));
      return chats;
    } catch (e) {
      assertIsError(e);
      throw new DeleteException(e.message);
    }
  }
}
