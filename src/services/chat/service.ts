import { PermissionLevel } from '@graasp/sdk';

import HookManager from '../../util/hook';
import { Repositories } from '../../util/repositories';
import { validatePermission } from '../authorization';
import { ChatMessage } from './chatMessage';
import { MemberCannotDeleteMessage, MemberCannotEditMessage } from './errors';
import { MentionService } from './plugins/mentions/service';

export class ChatMessageService {
  hooks = new HookManager();
  mentionService: MentionService;

  constructor(mentionService: MentionService) {
    this.mentionService = mentionService;
  }

  async getForItem(actor, repositories: Repositories, itemId: string): Promise<ChatMessage[]> {
    const { chatMessageRepository, itemRepository } = repositories;
    const item = await itemRepository.get(itemId);

    // check rights
    await validatePermission(repositories, PermissionLevel.Read, actor, item);

    const messages = await chatMessageRepository.getForItem(itemId);
    return messages;
  }

  async postOne(
    actor,
    repositories: Repositories,
    itemId: string,
    data: { body: string; mentions: string[] },
  ) {
    const { chatMessageRepository, itemRepository } = repositories;
    const item = await itemRepository.get(itemId);

    // check rights
    await validatePermission(repositories, PermissionLevel.Read, actor, item);

    const message = await chatMessageRepository.postOne({
      chatId: itemId,
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
    actor,
    repositories: Repositories,
    itemId: string,
    messageId: string,
    message: { body: string },
  ) {
    const { chatMessageRepository, itemRepository } = repositories;
    const item = await itemRepository.get(itemId);

    // check rights
    await validatePermission(repositories, PermissionLevel.Read, actor, item);

    // check right to make sure that the user is editing his own message
    const messageContent = await chatMessageRepository.get(messageId, { shouldExist: true });

    if (messageContent.creator.id !== actor.id) {
      throw new MemberCannotEditMessage(messageId);
    }

    return chatMessageRepository.patchOne(messageId, message);
  }

  async deleteOne(actor, repositories: Repositories, itemId: string, messageId: string) {
    const { chatMessageRepository, itemRepository } = repositories;
    const item = await itemRepository.get(itemId);

    // check rights
    await validatePermission(repositories, PermissionLevel.Read, actor, item);

    const messageContent = await chatMessageRepository.get(messageId, { shouldExist: true });
    if (messageContent.creator.id !== actor.id) {
      throw new MemberCannotDeleteMessage(messageId);
    }

    // TODO: get associated mentions to push the update in the websockets
    // await mentionRepository.getMany()

    await chatMessageRepository.deleteOne(messageId);
    return messageContent;
  }

  async clear(actor, repositories: Repositories, itemId: string) {
    const { chatMessageRepository, itemRepository } = repositories;

    // check rights for accessing the chat and sufficient right to clear the conversation
    // user should be an admin of the item
    const item = await itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    await chatMessageRepository.clearChat(itemId);
  }
}
