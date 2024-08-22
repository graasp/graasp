import { singleton } from 'tsyringe';

import { Repositories } from '../../../../utils/repositories';
import { Account } from '../../../account/entities/account';
import { Actor } from '../../../member/entities/member';
import { ItemService } from '../../service';
import { ItemFlag } from './itemFlag';

@singleton()
export class ItemFlagService {
  private readonly itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async getAllFlags(actor: Actor, repositories: Repositories) {
    const { itemFlagRepository } = repositories;
    return itemFlagRepository.getAllFlags();
  }

  async post(
    account: Account,
    repositories: Repositories,
    itemId: string,
    body: Partial<ItemFlag>,
  ) {
    const { itemFlagRepository } = repositories;

    // only register member can report
    await this.itemService.get(account, repositories, itemId);

    return itemFlagRepository.post(body, account, itemId);
  }
}
