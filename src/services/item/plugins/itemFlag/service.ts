import { singleton } from 'tsyringe';

import { FlagType } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { AuthenticatedUser } from '../../../../types';
import { ItemService } from '../../service';
import { FlagOptionsType } from './itemFlag.types';
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

  async post(
    db: DBConnection,
    actor: AuthenticatedUser,
    itemId: string,
    flagType: FlagOptionsType,
  ) {
    // only register member can report
    await this.itemService.get(db, actor, itemId);

    return this.itemFlagRepository.addOne(db, {
      flagType,
      creatorId: actor.id,
      itemId,
    });
  }
}
