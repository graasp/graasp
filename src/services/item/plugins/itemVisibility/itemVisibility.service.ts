import { singleton } from 'tsyringe';

import { type ItemVisibilityOptionsType } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { type MinimalMember } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { type ItemRaw } from '../../item';
import { ItemVisibilityRepository } from './itemVisibility.repository';

@singleton()
export class ItemVisibilityService {
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly itemVisibilityRepository: ItemVisibilityRepository;

  constructor(
    authorizedItemService: AuthorizedItemService,
    itemVisibilityRepository: ItemVisibilityRepository,
  ) {
    this.authorizedItemService = authorizedItemService;
    this.itemVisibilityRepository = itemVisibilityRepository;
  }

  async post(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: ItemRaw['id'],
    visibilityType: ItemVisibilityOptionsType,
  ) {
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: member.id,
      itemId,
      permission: 'admin',
    });
    await this.itemVisibilityRepository.post(dbConnection, member.id, item.path, visibilityType);
  }

  async deleteOne(
    dbConnection: DBConnection,
    accountId: MinimalMember['id'],
    itemId: ItemRaw['id'],
    visibilityType: ItemVisibilityOptionsType,
  ) {
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId,
      itemId,
      permission: 'admin',
    });

    await this.itemVisibilityRepository.deleteOne(dbConnection, item, visibilityType);
    return { item: { path: item.path } };
  }
}
