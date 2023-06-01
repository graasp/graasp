import { PermissionLevel } from '@graasp/sdk';

import HookManager from '../../utils/hook';
import { Repositories } from '../../utils/repositories';
import ItemService from '../item/service';
import { Actor, Member } from '../member/entities/member';
import { ChatMessage } from './chatMessage';
import { MemberCannotDeleteMessage, MemberCannotEditMessage } from './errors';
import { MentionService } from './plugins/mentions/service';

export class ChatMessageService {
  hooks = new HookManager();
  mentionService: MentionService;
  itemService: ItemService;

  constructor(itemService: ItemService, mentionService: MentionService) {
    this.itemService = itemService;
    this.mentionService = mentionService;
  }

  async getForItem(
    actor: Actor,
    repositories: Repositories,
    itemId: string,
  ): Promise<ChatMessage[]> {
    const { chatMessageRepository } = repositories;

    // check permission
    await this.itemService.get(actor, repositories, itemId);

    const messages = await chatMessageRepository.getForItem(itemId);
    return messages;
  }

  async postOne(
    actor: Member,
    repositories: Repositories,
    itemId: string,
    data: { body: string; mentions: string[] },
  ) {
    const { chatMessageRepository } = repositories;

    // check permission
    await this.itemService.get(actor, repositories, itemId);

    const message = await chatMessageRepository.postOne({
      itemId,
      creator: actor,
      body: data.body,
    });

    // post the mentions that are sent with the message
    if (data.mentions?.length) {
      await this.mentionService.createManyForItem(actor, repositories, message, data.mentions);
    }
    return message;
  }

  async patchOne(
    actor: Member,
    repositories: Repositories,
    itemId: string,
    messageId: string,
    message: { body: string },
  ) {
    const { chatMessageRepository } = repositories;

    // check permission
    await this.itemService.get(actor, repositories, itemId);

    // check right to make sure that the user is editing his own message
    const messageContent = await chatMessageRepository.get(messageId, { shouldExist: true });

    if (messageContent.creator?.id !== actor.id) {
      throw new MemberCannotEditMessage(messageId);
    }

    return chatMessageRepository.patchOne(messageId, message);
  }

  async deleteOne(actor: Member, repositories: Repositories, itemId: string, messageId: string) {
    const { chatMessageRepository } = repositories;

    // check permission
    await this.itemService.get(actor, repositories, itemId);

    const messageContent = await chatMessageRepository.get(messageId, { shouldExist: true });
    if (messageContent.creator?.id !== actor.id) {
      throw new MemberCannotDeleteMessage(messageId);
    }

    // TODO: get associated mentions to push the update in the websockets
    // await mentionRepository.getMany()

    await chatMessageRepository.deleteOne(messageId);
    return messageContent;
  }

  async clear(actor: Member, repositories: Repositories, itemId: string) {
    const { chatMessageRepository } = repositories;

    // check rights for accessing the chat and sufficient right to clear the conversation
    // user should be an admin of the item
    await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    await chatMessageRepository.clearChat(itemId);
  }
}
