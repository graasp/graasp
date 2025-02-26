import { ChatBotMessage, GPTVersion, PermissionLevel } from '@graasp/sdk';

import { AuthenticatedUser } from '../../../../../types';
import { Repositories } from '../../../../../utils/repositories';
import { validatePermission } from '../../../../authorization';
import { fetchOpenAI } from './utils';

export class ChatBotService {
  async post(
    account: AuthenticatedUser,
    repositories: Repositories,
    itemId: string,
    body: Array<ChatBotMessage>,
    gptVersion: GPTVersion,
    temperature: number,
  ) {
    const { itemRepository } = repositories;
    const item = await itemRepository.getOneOrThrow(itemId);

    // check that the member can read the item to be allowed to interact with the chat
    await validatePermission(repositories, PermissionLevel.Read, account, item);

    return fetchOpenAI(body, gptVersion, temperature);
  }
}
