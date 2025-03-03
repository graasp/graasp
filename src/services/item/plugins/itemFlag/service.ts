import { singleton } from 'tsyringe';

import { FlagType } from '@graasp/sdk';

import { AuthenticatedUser } from '../../../../types';
import { Repositories } from '../../../../utils/repositories';
import { ItemService } from '../../service';

@singleton()
export class ItemFlagService {
  private readonly itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async getAllFlagTypes() {
    return Object.values(FlagType);
  }

  async post(
    account: AuthenticatedUser,
    repositories: Repositories,
    itemId: string,
    flagType: FlagType,
  ) {
    const { itemFlagRepository } = repositories;

    // only register member can report
    await this.itemService.get(account, repositories, itemId);

    return itemFlagRepository.addOne({ flagType, creatorId: account.id, itemId });
  }
}
