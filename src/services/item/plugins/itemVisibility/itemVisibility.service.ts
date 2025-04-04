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
    db: DBConnection,
    member: MinimalMember,
    id: string,
    visibilityType: ItemVisibilityOptionsType,
  ) {
    const item = await this.basicItemService.get(db, member, id, PermissionLevel.Admin);
    const newVisibility = await this.itemVisibilityRepository.post(
      db,
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
    db: DBConnection,
    member: MinimalMember,
    id: string,
    visibilityType: ItemVisibilityOptionsType,
  ) {
    const item = await this.basicItemService.get(db, member, id, PermissionLevel.Admin);

    await this.itemVisibilityRepository.deleteOne(db, item, visibilityType);
    return { item: { path: item.path } };
  }
}
