import { asc, eq, inArray } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { DBConnection } from '../../drizzle/db';
import { chatMessagesTable } from '../../drizzle/schema';
import {
  ChatMessageInsertDTO,
  ChatMessageRaw,
  ChatMessageWithCreator,
  ChatMessageWithCreatorAndItem,
} from '../../drizzle/types';
import { DeleteException } from '../../repositories/errors';
import { throwsIfParamIsInvalid } from '../../repositories/utils';
import { assertIsError } from '../../utils/assertions';

@singleton()
export class ChatMessageRepository {
  /**
   * Retrieves all the messages related to the given item
   * @param itemId Id of item to retrieve messages for
   */
  async getByItem(db: DBConnection, itemId: string): Promise<ChatMessageWithCreator[]> {
    throwsIfParamIsInvalid('itemId', itemId);

    return await db.query.chatMessagesTable.findMany({
      where: eq(chatMessagesTable.itemId, itemId),
      with: { creator: true, item: true },
      orderBy: asc(chatMessagesTable.createdAt),
    });
  }

  /**
   * Retrieves all the messages related to the given items
   * @param itemIds Id of items to retrieve messages for
   */
  async getByItems(db: DBConnection, itemIds: string[]): Promise<ChatMessageRaw[]> {
    throwsIfParamIsInvalid('itemIds', itemIds);

    const messages = await db.query.chatMessagesTable.findMany({
      where: inArray(chatMessagesTable.itemId, itemIds),
      with: { creator: true, item: true },
    });
    return messages;
  }

  /**
   * Retrieves a message by its id
   * @param id Id of the message to retrieve
   */
  async getOne(db: DBConnection, id: string): Promise<ChatMessageWithCreatorAndItem | undefined> {
    return await db.query.chatMessagesTable.findFirst({
      where: eq(chatMessagesTable.id, id),
      with: { item: true, creator: true },
    });
  }

  /**
   * Adds a message to the given chat
   * @param message Message
   */
  async addOne(
    db: DBConnection,
    message: {
      itemId: string;
      creatorId: string;
      body: string;
    },
  ): Promise<ChatMessageRaw> {
    const res = await db.insert(chatMessagesTable).values(message).returning();
    return res[0];
  }

  /**
   * Edit a message of the given chat
   * @param id message id to edit
   * @param data data for the message to edit
   */
  async updateOne(
    db: DBConnection,
    id: string,
    data: ChatMessageInsertDTO,
  ): Promise<ChatMessageRaw> {
    return await db
      .update(chatMessagesTable)
      .set(data)
      .where(eq(chatMessagesTable.id, id))
      .returning()[0];
  }

  async deleteOne(db: DBConnection, id: string): Promise<void> {
    await db.delete(chatMessagesTable).where(eq(chatMessagesTable.id, id));
  }

  /*
   * Remove all messages for the item
   * @param itemId Id of item to clear the chat
   */
  async deleteByItem(db: DBConnection, itemId: string): Promise<void> {
    throwsIfParamIsInvalid('itemId', itemId);

    try {
      await db.delete(chatMessagesTable).where(eq(chatMessagesTable.itemId, itemId));
    } catch (e) {
      assertIsError(e);
      throw new DeleteException(e.message);
    }
  }
}
