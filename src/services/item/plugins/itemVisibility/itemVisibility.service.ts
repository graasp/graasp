import { singleton } from 'tsyringe';

import { ItemVisibilityOptionsType, PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { MinimalMember } from '../../../../types';
import { BasicItemService } from '../../basic.service';
import { ItemVisibilityRepository } from './itemVisibility.repository';

@singleton()
export class ItemVisibilityService {
  private readonly basicItemService: BasicItemService;
  private readonly itemVisibilityRepository: ItemVisibilityRepository;

  constructor(
    basicItemService: BasicItemService,
    itemVisibilityRepository: ItemVisibilityRepository,
  ) {
    this.basicItemService = basicItemService;
    this.itemVisibilityRepository = itemVisibilityRepository;
  }

  async post(
    dbConnection: DBConnection,
    member: MinimalMember,
    id: string,
    visibilityType: ItemVisibilityOptionsType,
  ) {
    const item = await this.basicItemService.get(dbConnection, member, id, PermissionLevel.Admin);
    const newVisibility = await this.itemVisibilityRepository.post(
      dbConnection,
      member.id,
      item.path,
      visibilityType,
    );
    return {
      ...newVisibility,
      item: { path: item.path },
    };
  }

  async deleteOne(
    dbConnection: DBConnection,
    member: MinimalMember,
    id: string,
    visibilityType: ItemVisibilityOptionsType,
  ) {
    const item = await this.basicItemService.get(dbConnection, member, id, PermissionLevel.Admin);

    await this.itemVisibilityRepository.deleteOne(dbConnection, item, visibilityType);
    return { item: { path: item.path } };
  }
}
