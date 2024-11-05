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

  async has({ itemVisibilityRepository }: Repositories, path: string, tagType: ItemVisibilityType) {
    return await itemVisibilityRepository.getType(path, tagType);
  }

  async post(member: Member, repositories: Repositories, id: string, tagType: ItemVisibilityType) {
    const { itemVisibilityRepository } = repositories;
    const item = await this.itemService.get(member, repositories, id, PermissionLevel.Admin);
    return {
      ...(await itemVisibilityRepository.post(member, item, tagType)),
      item: { path: item.path },
    };
  }

  async deleteOne(
    member: Member,
    repositories: Repositories,
    id: string,
    tagType: ItemVisibilityType,
  ) {
    const { itemVisibilityRepository } = repositories;
    const item = await this.itemService.get(member, repositories, id, PermissionLevel.Admin);

    await itemVisibilityRepository.deleteOne(item, tagType);
    return { item: { path: item.path } };
  }
}
