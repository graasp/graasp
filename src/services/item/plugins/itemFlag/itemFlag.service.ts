import { singleton } from 'tsyringe';

import { FlagType } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import type { AuthenticatedUser } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemFlagRepository } from './itemFlag.repository';

@singleton()
export class ItemFlagService {
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly itemFlagRepository: ItemFlagRepository;

  constructor(
    authorizedItemService: AuthorizedItemService,
    itemFlagRepository: ItemFlagRepository,
  ) {
    this.authorizedItemService = authorizedItemService;
    this.itemFlagRepository = itemFlagRepository;
  }

  async getAllFlagTypes() {
    return Object.values(FlagType);
  }

  async post(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    itemId: string,
    flagType: FlagType,
  ) {
    // only register member can report
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: account.id,
      itemId,
    });

    await this.itemFlagRepository.addOne(dbConnection, {
      flagType,
      creatorId: account.id,
      itemId,
    });
  }
}
