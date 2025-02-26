import { singleton } from 'tsyringe';

import { ItemVisibilityOptionsType, PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { Member } from '../../../member/entities/member';
import { ItemService } from '../../service';
import { ItemVisibilityRepository } from './repository';

@singleton()
export class ItemVisibilityService {
  private readonly itemService: ItemService;
  private readonly itemVisibilityRepository: ItemVisibilityRepository;

  constructor(itemService: ItemService, itemVisibilityRepository: ItemVisibilityRepository) {
    this.itemService = itemService;
    this.itemVisibilityRepository = itemVisibilityRepository;
  }

  async has(db: DBConnection, path: string, visibilityType: ItemVisibilityOptionsType) {
    return await this.itemVisibilityRepository.getType(path, visibilityType);
  }

  async post(
    db: DBConnection,
    member: Member,
    id: string,
    visibilityType: ItemVisibilityOptionsType,
  ) {
    const item = await this.itemService.get(db, member, id, PermissionLevel.Admin);
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
    member: Member,
    id: string,
    visibilityType: ItemVisibilityOptionsType,
  ) {
    const item = await this.itemService.get(db, member, id, PermissionLevel.Admin);

    await this.itemVisibilityRepository.deleteOne(item, visibilityType);
    return { item: { path: item.path } };
  }
}
