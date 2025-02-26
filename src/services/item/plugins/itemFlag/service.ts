import { singleton } from 'tsyringe';

import { FlagType } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { Account } from '../../../account/entities/account';
import { ItemService } from '../../service';
import { ItemFlagRepository } from './repository';

@singleton()
export class ItemFlagService {
  private readonly itemService: ItemService;
  private readonly itemFlagRepository: ItemFlagRepository;

  constructor(itemService: ItemService, itemFlagRepository: ItemFlagRepository) {
    this.itemService = itemService;
    this.itemFlagRepository = itemFlagRepository;
  }

  async getAllFlagTypes() {
    return Object.values(FlagType);
  }

  async post(db: DBConnection, account: Account, itemId: string, flagType: FlagType) {
    // only register member can report
    await this.itemService.get(db, account, itemId);

    return this.itemFlagRepository.addOne(db, { flagType, creator: account, itemId });
  }
}
