import { asc, eq, inArray } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import type { DBConnection } from '../../drizzle/db';
import { chatMessagesTable } from '../../drizzle/schema';
import type {
  ChatMessageInsertDTO,
  ChatMessageRaw,
  ChatMessageWithCreator,
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
  async getByItem(dbConnection: DBConnection, itemId: string): Promise<ChatMessageWithCreator[]> {
    throwsIfParamIsInvalid('itemId', itemId);

    return await dbConnection.query.chatMessagesTable.findMany({
      where: eq(chatMessagesTable.itemId, itemId),
      with: { creator: true, item: true },
      orderBy: asc(chatMessagesTable.createdAt),
    });
  }

  /**
   * Retrieves all the messages related to the given items
   * @param itemIds Id of items to retrieve messages for
   */
  async getByItems(dbConnection: DBConnection, itemIds: string[]): Promise<ChatMessageRaw[]> {
    throwsIfParamIsInvalid('itemIds', itemIds);

    const messages = await dbConnection.query.chatMessagesTable.findMany({
      where: inArray(chatMessagesTable.itemId, itemIds),
      with: { creator: true, item: true },
    });
    return messages;
  }

  /**
   * Retrieves a message by its id
   * @param id Id of the message to retrieve
   */
  async getOne(
    dbConnection: DBConnection,
    id: string,
  ): Promise<ChatMessageWithCreator | undefined> {
    const res = await dbConnection.query.chatMessagesTable.findFirst({
      where: eq(chatMessagesTable.id, id),
      with: { creator: true },
    });
    return res;
  }

  /**
   * Adds a message to the given chat
   * @param message Message
   */
  async addOne(
    dbConnection: DBConnection,
    message: {
      itemId: string;
      creatorId: string;
      body: string;
    },
  ): Promise<ChatMessageRaw> {
    const res = await dbConnection.insert(chatMessagesTable).values(message).returning();
    return res[0];
  }

  /**
   * Edit a message of the given chat
   * @param id message id to edit
   * @param data data for the message to edit
   */
  async updateOne(
    dbConnection: DBConnection,
    id: string,
    data: ChatMessageInsertDTO,
  ): Promise<ChatMessageRaw> {
    const res = await dbConnection
      .update(chatMessagesTable)
      .set(data)
      .where(eq(chatMessagesTable.id, id))
      .returning();
    return res[0];
  }

  async deleteOne(dbConnection: DBConnection, id: string): Promise<void> {
    await dbConnection.delete(chatMessagesTable).where(eq(chatMessagesTable.id, id));
  }

  /*
   * Remove all messages for the item
   * @param itemId Id of item to clear the chat
   */
  async deleteByItem(dbConnection: DBConnection, itemId: string): Promise<void> {
    throwsIfParamIsInvalid('itemId', itemId);

    try {
      await dbConnection.delete(chatMessagesTable).where(eq(chatMessagesTable.itemId, itemId));
    } catch (e) {
      assertIsError(e);
      throw new DeleteException(e.message);
    }
  }
}
