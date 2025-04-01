import { singleton } from 'tsyringe';

import { FlagType } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { AuthenticatedUser } from '../../../../types';
import { BasicItemService } from '../../basic.service';
import { ItemFlagRepository } from './itemFlag.repository';

@singleton()
export class ItemFlagService {
  private readonly basicItemService: BasicItemService;
  private readonly itemFlagRepository: ItemFlagRepository;

  constructor(basicItemService: BasicItemService, itemFlagRepository: ItemFlagRepository) {
    this.basicItemService = basicItemService;
    this.itemFlagRepository = itemFlagRepository;
  }

  async getAllFlagTypes() {
    return Object.values(FlagType);
  }

  async post(db: DBConnection, actor: AuthenticatedUser, itemId: string, flagType: FlagType) {
    // only register member can report
    await this.basicItemService.get(db, actor, itemId);

    await this.itemFlagRepository.addOne(db, {
      flagType,
      creatorId: actor.id,
      itemId,
    });
  }
}
