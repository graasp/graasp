import { singleton } from 'tsyringe';

import { ChatBotMessage, GPTVersion, PermissionLevel } from '@graasp/sdk';

import { type DBConnection } from '../../../../../drizzle/db';
import { AuthenticatedUser } from '../../../../../types';
import { AuthorizedItemService } from '../../../../authorization';
import { ItemRepository } from '../../../item.repository';
import { fetchOpenAI } from './utils';

@singleton()
export class ChatBotService {
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly itemRepository: ItemRepository;

  constructor(authorizedItemService: AuthorizedItemService, itemRepository: ItemRepository) {
    this.authorizedItemService = authorizedItemService;
    this.itemRepository = itemRepository;
  }

  async post(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    itemId: string,
    body: Array<ChatBotMessage>,
    gptVersion: GPTVersion,
    temperature: number,
  ) {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // check that the member can read the item to be allowed to interact with the chat
    await this.authorizedItemService.validatePermission(
      dbConnection,
      PermissionLevel.Read,
      account,
      item,
    );

    return fetchOpenAI(body, gptVersion, temperature);
  }
}
