import { ChatBotMessage, GPTVersion, PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db'; 
import { Account } from '../../../../account/entities/account';
import { AuthorizationService } from '../../../../authorization';
import { ItemRepository } from '../../../repository';
import { fetchOpenAI } from './utils';

export class ChatBotService {
  private readonly authorizationService: AuthorizationService;
  private readonly itemRepository: ItemRepository;

  constructor(authorizationService: AuthorizationService, itemRepository: ItemRepository) {
    this.authorizationService = authorizationService;
    this.itemRepository = itemRepository;
  }

  async post(
    db: DBConnection,
    account: Account,
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
