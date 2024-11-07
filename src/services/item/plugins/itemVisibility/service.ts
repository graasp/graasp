import { singleton } from 'tsyringe';

import { ItemVisibilityType, PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { Member } from '../../../member/entities/member';
import { ItemService } from '../../service';

@singleton()
export class ItemVisibilityService {
  private readonly itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async has(
    { itemVisibilityRepository }: Repositories,
    path: string,
    visibilityType: ItemVisibilityType,
  ) {
    return await itemVisibilityRepository.getType(path, visibilityType);
  }

  async post(
    member: Member,
    repositories: Repositories,
    id: string,
    visibilityType: ItemVisibilityType,
  ) {
    const { itemVisibilityRepository } = repositories;
    const item = await this.itemService.get(member, repositories, id, PermissionLevel.Admin);
    return {
      ...(await itemVisibilityRepository.post(member, item, visibilityType)),
      item: { path: item.path },
    };
  }

  async deleteOne(
    member: Member,
    repositories: Repositories,
    id: string,
    visibilityType: ItemVisibilityType,
  ) {
    const { itemVisibilityRepository } = repositories;
    const item = await this.itemService.get(member, repositories, id, PermissionLevel.Admin);

    await itemVisibilityRepository.deleteOne(item, visibilityType);
    return { item: { path: item.path } };
  }
}
