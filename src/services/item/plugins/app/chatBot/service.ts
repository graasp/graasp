import { ChatBotMessage, GPTVersion, PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../../../utils/repositories';
import { validatePermission } from '../../../../authorization';
import { Member } from '../../../../member/entities/member';
import { fetchOpenAI } from './utils';

export class ChatBotService {
  async post(
    member: Member,
    repositories: Repositories,
    itemId: string,
    body: Array<ChatBotMessage>,
    gptVersion: GPTVersion,
  ) {
    const { itemRepository } = repositories;
    const item = await itemRepository.getOneOrThrow(itemId);

    // check that the member can read the item to be allowed to interact with the chat
    await validatePermission(repositories, PermissionLevel.Read, member, item);

    return fetchOpenAI(body, gptVersion);
  }
}
