import { singleton } from 'tsyringe';

import { type DBConnection } from '../../drizzle/db';
import type { AuthenticatedUser, MaybeUser } from '../../types';
import { AuthorizedItemService } from '../authorizedItem.service';
import { ChatMessageRepository } from './chatMessage.repository';
import { ChatMessageNotFound, MemberCannotDeleteMessage, MemberCannotEditMessage } from './errors';
import { MentionService } from './plugins/mentions/chatMention.service';

@singleton()
export class ChatMessageService {
  private readonly mentionService: MentionService;
  private readonly chatMessageRepository: ChatMessageRepository;
  private readonly authorizedItemService: AuthorizedItemService;

  constructor(
    mentionService: MentionService,
    authorizedItemService: AuthorizedItemService,
    chatMessageRepository: ChatMessageRepository,
  ) {
    this.mentionService = mentionService;
    this.chatMessageRepository = chatMessageRepository;
    this.authorizedItemService = authorizedItemService;
  }

  async getForItem(dbConnection: DBConnection, maybeUser: MaybeUser, itemId: string) {
    // check permission
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: maybeUser?.id,
      itemId,
    });

    return await this.chatMessageRepository.getByItem(dbConnection, itemId);
  }

  async postOne(
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    itemId: string,
    data: { body: string; mentions?: string[] },
  ) {
    // check permission
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: authenticatedUser?.id,
      itemId,
    });

    const message = await this.chatMessageRepository.addOne(dbConnection, {
      itemId,
      creatorId: authenticatedUser.id,
      body: data.body,
    });

    // post the mentions that are sent with the message
    if (data.mentions?.length) {
      await this.mentionService.createManyForItem(
        dbConnection,
        authenticatedUser,
        message,
        data.mentions,
      );
    }

    const messageWithCreator = { ...message, creator: authenticatedUser };

    return messageWithCreator;
  }

  async patchOne(
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    itemId: string,
    messageId: string,
    message: { body: string },
  ) {
    // check permission
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: authenticatedUser.id,
      itemId,
    });

    // check right to make sure that the user is editing his own message
    const messageContent = await this.chatMessageRepository.getOne(dbConnection, messageId);

    if (!messageContent) {
      throw new ChatMessageNotFound(messageId);
    }

    if (messageContent.creator?.id !== authenticatedUser.id) {
      throw new MemberCannotEditMessage(messageId);
    }

    const updatedMessage = await this.chatMessageRepository.updateOne(dbConnection, messageId, {
      itemId,
      ...message,
    });
    // assumes update can only be done by the author of the message
    const updatedMessageWithCreator = { ...updatedMessage, creator: authenticatedUser };

    return updatedMessageWithCreator;
  }

  async deleteOne(
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    itemId: string,
    messageId: string,
  ) {
    // check permission
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: authenticatedUser.id,
      itemId,
    });

    const messageContent = await this.chatMessageRepository.getOne(dbConnection, messageId);
    if (!messageContent) {
      throw new ChatMessageNotFound(messageId);
    }

    if (messageContent.creator?.id !== authenticatedUser.id) {
      throw new MemberCannotDeleteMessage({ id: messageId });
    }

    await this.chatMessageRepository.deleteOne(dbConnection, messageId);

    return messageContent;
  }

  async clear(dbConnection: DBConnection, authenticatedUser: AuthenticatedUser, itemId: string) {
    // check rights for accessing the chat and sufficient right to clear the conversation
    // user should be an admin of the item
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: authenticatedUser.id,
      itemId,
      permission: 'admin',
    });

    await this.chatMessageRepository.deleteByItem(dbConnection, itemId);
  }
}
