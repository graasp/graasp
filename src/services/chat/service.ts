import { singleton } from 'tsyringe';

import { PermissionLevel } from '@graasp/sdk';

import HookManager from '../../utils/hook';
import { Repositories } from '../../utils/repositories';
import { Account } from '../account/entities/account';
import { ItemService } from '../item/service';
import { Actor } from '../member/entities/member';
import { ChatMessage } from './chatMessage';
import { MemberCannotDeleteMessage, MemberCannotEditMessage } from './errors';
import { MentionService } from './plugins/mentions/service';

@singleton()
export class ChatMessageService {
  hooks = new HookManager();
  private readonly mentionService: MentionService;
  private readonly itemService: ItemService;

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

    const messages = await chatMessageRepository.getByItem(itemId);
    return messages;
  }

  async postOne(
    actor: Account,
    repositories: Repositories,
    itemId: string,
    data: { body: string; mentions: string[] },
  ) {
    const { chatMessageRepository } = repositories;

    // check permission
    await this.itemService.get(actor, repositories, itemId);

    const message = await chatMessageRepository.addOne({
      itemId,
      creator: actor,
      body: data.body,
    });

    // post the mentions that are sent with the message
    if (data.mentions?.length) {
      await this.mentionService.createManyForItem(actor, repositories, message, data.mentions);
    }

    await this.hooks.runPostHooks('publish', actor, repositories, { message: message });

    return message;
  }

  async patchOne(
    actor: Account,
    repositories: Repositories,
    itemId: string,
    messageId: string,
    message: { body: string },
  ) {
    const { chatMessageRepository } = repositories;

    // check permission
    await this.itemService.get(actor, repositories, itemId);

    // check right to make sure that the user is editing his own message
    const messageContent = await chatMessageRepository.getOneOrThrow(messageId);

    if (messageContent.creator?.id !== actor.id) {
      throw new MemberCannotEditMessage(messageId);
    }

    const updatedMessage = await chatMessageRepository.updateOne(messageId, message);

    await this.hooks.runPostHooks('update', actor, repositories, { message: updatedMessage });

    return updatedMessage;
  }

  async deleteOne(actor: Account, repositories: Repositories, itemId: string, messageId: string) {
    const { chatMessageRepository } = repositories;

    // check permission
    await this.itemService.get(actor, repositories, itemId);

    const messageContent = await chatMessageRepository.getOneOrThrow(messageId);

    if (messageContent.creator?.id !== actor.id) {
      throw new MemberCannotDeleteMessage({ id: messageId });
    }

    // TODO: get associated mentions to push the update in the websockets
    // await mentionRepository.getMany()

    await chatMessageRepository.deleteOne(messageId);

    await this.hooks.runPostHooks('delete', actor, repositories, { message: messageContent });

    return messageContent;
  }

  async clear(actor: Account, repositories: Repositories, itemId: string) {
    const { chatMessageRepository } = repositories;

    // check rights for accessing the chat and sufficient right to clear the conversation
    // user should be an admin of the item
    await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    await this.hooks.runPostHooks('clear', actor, repositories, { itemId });

    await chatMessageRepository.deleteByItem(itemId);
  }
}
