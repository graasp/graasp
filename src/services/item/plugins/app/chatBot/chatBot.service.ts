import { singleton } from 'tsyringe';

import { ChatBotMessage, GPTVersion, PermissionLevel } from '@graasp/sdk';

import { type DBConnection } from '../../../../../drizzle/db';
import { AuthenticatedUser } from '../../../../../types';
import { AuthorizedItemService } from '../../../../authorizedItem.service';
import { fetchOpenAI } from './utils';

@singleton()
export class ChatBotService {
  private readonly authorizedItemService: AuthorizedItemService;

  constructor(authorizedItemService: AuthorizedItemService) {
    this.authorizedItemService = authorizedItemService;
  }

  async post(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    itemId: string,
    body: Array<ChatBotMessage>,
    gptVersion: GPTVersion,
    temperature: number,
  ) {
    // check that the member can read the item to be allowed to interact with the chat
    await this.authorizedItemService.assertPermissionForItemId(dbConnection, {
      permission: PermissionLevel.Read,
      actor: account,
      itemId,
    });

    return fetchOpenAI(body, gptVersion, temperature);
  }
}
