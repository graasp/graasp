import { singleton } from 'tsyringe';

import { PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import { AuthenticatedUser, MaybeUser } from '../../types';
import HookManager from '../../utils/hook';
import { BasicItemService } from '../item/basic.service';
import { ChatMessageNotFound, MemberCannotDeleteMessage, MemberCannotEditMessage } from './errors';
import { MentionService } from './plugins/mentions/service';
import { ChatMessageRepository } from './repository';

@singleton()
export class ChatMessageService {
  hooks = new HookManager();
  private readonly mentionService: MentionService;
  private readonly basicItemService: BasicItemService;
  private readonly chatMessageRepository: ChatMessageRepository;

  constructor(
    basicItemService: BasicItemService,
    mentionService: MentionService,
    chatMessageRepository: ChatMessageRepository,
  ) {
    this.basicItemService = basicItemService;
    this.mentionService = mentionService;
    this.chatMessageRepository = chatMessageRepository;
  }

  async getForItem(db: DBConnection, actor: MaybeUser, itemId: string) {
    // check permission
    await this.basicItemService.get(db, actor, itemId);

    return await this.chatMessageRepository.getByItem(db, itemId);
  }

  async postOne(
    db: DBConnection,
    actor: AuthenticatedUser,
    itemId: string,
    data: { body: string; mentions?: string[] },
  ) {
    // check permission
    await this.basicItemService.get(db, actor, itemId);

    const message = await this.chatMessageRepository.addOne(db, {
      itemId,
      creatorId: actor.id,
      body: data.body,
    });

    // post the mentions that are sent with the message
    if (data.mentions?.length) {
      await this.mentionService.createManyForItem(db, actor, message, data.mentions);
    }

    await this.hooks.runPostHooks('publish', actor, db, {
      message,
    });

    return message;
  }

  async patchOne(
    db: DBConnection,
    authenticatedUser: AuthenticatedUser,
    itemId: string,
    messageId: string,
    message: { body: string },
  ) {
    // check permission
    await this.basicItemService.get(db, authenticatedUser, itemId);

    // check right to make sure that the user is editing his own message
    const messageContent = await this.chatMessageRepository.getOne(db, messageId);

    if (!messageContent) {
      throw new ChatMessageNotFound(messageId);
    }

    if (messageContent.creator?.id !== authenticatedUser.id) {
      throw new MemberCannotEditMessage(messageId);
    }

    const updatedMessage = await this.chatMessageRepository.updateOne(db, messageId, {
      itemId,
      ...message,
    });

    await this.hooks.runPostHooks('update', authenticatedUser, db, {
      message: updatedMessage,
    });

    return updatedMessage;
  }

  async deleteOne(
    db: DBConnection,
    authenticatedUser: AuthenticatedUser,
    itemId: string,
    messageId: string,
  ) {
    // check permission
    await this.basicItemService.get(db, authenticatedUser, itemId);

    const messageContent = await this.chatMessageRepository.getOne(db, messageId);
    if (!messageContent) {
      throw new ChatMessageNotFound(messageId);
    }

    if (messageContent.creator?.id !== authenticatedUser.id) {
      throw new MemberCannotDeleteMessage({ id: messageId });
    }

    // TODO: get associated mentions to push the update in the websockets
    // await mentionRepository.getMany()

    await this.chatMessageRepository.deleteOne(db, messageId);

    await this.hooks.runPostHooks('delete', authenticatedUser, db, {
      message: messageContent,
    });

    return messageContent;
  }

  async clear(db: DBConnection, authenticatedUser: AuthenticatedUser, itemId: string) {
    // check rights for accessing the chat and sufficient right to clear the conversation
    // user should be an admin of the item
    await this.basicItemService.get(db, authenticatedUser, itemId, PermissionLevel.Admin);

    await this.hooks.runPostHooks('clear', authenticatedUser, db, { itemId });

    await this.chatMessageRepository.deleteByItem(db, itemId);
  }
}
