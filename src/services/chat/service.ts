import { singleton } from 'tsyringe';

import { PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import { AuthenticatedUser } from '../../types';
import HookManager from '../../utils/hook';
import { Account } from '../account/entities/account';
import { ItemService } from '../item/service';
import { Guest } from '../itemLogin/entities/guest';
import { Member } from '../member/entities/member';
import { ChatMessage } from './chatMessage';
import { MemberCannotDeleteMessage, MemberCannotEditMessage } from './errors';
import { MentionService } from './plugins/mentions/service';
import { ChatMessageRepository } from './repository';

@singleton()
export class ChatMessageService {
  hooks = new HookManager();
  private readonly mentionService: MentionService;
  private readonly itemService: ItemService;
  private readonly chatMessageRepository: ChatMessageRepository;

  constructor(
    itemService: ItemService,
    mentionService: MentionService,
    chatMessageRepository: ChatMessageRepository,
  ) {
    this.itemService = itemService;
    this.mentionService = mentionService;
    this.chatMessageRepository = chatMessageRepository;
  }

  async getForItem(
    db: DBConnection,
    actor: AuthenticatedUser,
    itemId: string,
  ): Promise<ChatMessage[]> {
    // check permission
    await this.itemService.get(db, actor, itemId);

    return await this.chatMessageRepository.getByItem(db, itemId);
  }

  async postOne(
    db: DBConnection,
    actor: Guest | Member,
    itemId: string,
    data: { body: string; mentions?: string[] },
  ) {
    // check permission
    await this.itemService.get(db, actor, itemId);

    const message = await this.chatMessageRepository.addOne(db, {
      itemId,
      creator: actor,
      body: data.body,
    });

    // post the mentions that are sent with the message
    if (data.mentions?.length) {
      await this.mentionService.createManyForItem(db, actor, message, data.mentions);
    }

    await this.hooks.runPostHooks('publish', actor, db, {
      message: message,
    });

    return message;
  }

  async patchOne(
    db: DBConnection,
    actor: Account,
    itemId: string,
    messageId: string,
    message: { body: string },
  ) {
    // check permission
    await this.itemService.get(db, actor, itemId);

    // check right to make sure that the user is editing his own message
    const messageContent = await this.chatMessageRepository.getOne(db, messageId);

    if (!messageContent) {
      throw new ChatMessageNotFound(messageId);
    }

    if (messageContent.creator?.id !== actor.id) {
      throw new MemberCannotEditMessage(messageId);
    }

    const updatedMessage = await this.chatMessageRepository.updateOne(db, messageId, message);

    await this.hooks.runPostHooks('update', actor, db, {
      message: updatedMessage,
    });

    return updatedMessage;
  }

  async deleteOne(db: DBConnection, actor: Account, itemId: string, messageId: string) {
    // check permission
    await this.itemService.get(db, actor, itemId);

    const messageContent = await this.chatMessageRepository.getOne(db, messageId);
    if (!messageContent) {
      throw new ChatMessageNotFound(messageId);
    }

    if (messageContent.creator?.id !== actor.id) {
      throw new MemberCannotDeleteMessage({ id: messageId });
    }

    // TODO: get associated mentions to push the update in the websockets
    // await mentionRepository.getMany()

    await this.chatMessageRepository.deleteOne(db, messageId);

    await this.hooks.runPostHooks('delete', actor, db, {
      message: messageContent,
    });

    return messageContent;
  }

  async clear(db: DBConnection, actor: Account, itemId: string) {
    // check rights for accessing the chat and sufficient right to clear the conversation
    // user should be an admin of the item
    await this.itemService.get(db, actor, itemId, PermissionLevel.Admin);

    await this.hooks.runPostHooks('clear', actor, db, { itemId });

    await this.chatMessageRepository.deleteByItem(db, itemId);
  }
}
