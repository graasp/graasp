import { ChatBotMessage, GPTVersion, PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../../../utils/repositories.js';
import { validatePermission } from '../../../../authorization.js';
import { Member } from '../../../../member/entities/member.js';
import { fetchOpenAI } from './utils.js';

export class ChatBotService {
  async post(
    member: Member,
    repositories: Repositories,
    itemId: string,
    body: ChatBotMessage[],
    gptVersion: GPTVersion,
  ) {
    const { itemRepository } = repositories;
    const item = await itemRepository.get(itemId);

    // check that the member can read the item to be allowed to interact with the chat
    await validatePermission(repositories, PermissionLevel.Read, member, item);

    return fetchOpenAI(body, gptVersion);
  }
}
