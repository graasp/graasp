import { singleton } from 'tsyringe';

import { ChatBotMessage, GPTVersion, PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { AuthenticatedUser } from '../../../../../types';
import { AuthorizationService } from '../../../../authorization';
import { ItemRepository } from '../../../item.repository';
import { fetchOpenAI } from './utils';

@singleton()
export class ChatBotService {
  private readonly authorizationService: AuthorizationService;
  private readonly itemRepository: ItemRepository;

  constructor(authorizationService: AuthorizationService, itemRepository: ItemRepository) {
    this.authorizationService = authorizationService;
    this.itemRepository = itemRepository;
  }

  async post(
    db: DBConnection,
    account: AuthenticatedUser,
    itemId: string,
    body: Array<ChatBotMessage>,
    gptVersion: GPTVersion,
    temperature: number,
  ) {
    const item = await this.itemRepository.getOneOrThrow(db, itemId);

    // check that the member can read the item to be allowed to interact with the chat
    await this.authorizationService.validatePermission(db, PermissionLevel.Read, account, item);

    return fetchOpenAI(body, gptVersion, temperature);
  }
}
