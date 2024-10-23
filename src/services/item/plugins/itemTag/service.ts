import { singleton } from 'tsyringe';

import { ItemTagType, PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { Member } from '../../../member/entities/member';
import { ItemService } from '../../service';

@singleton()
export class ItemTagService {
  private readonly itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async has({ itemTagRepository }: Repositories, path: string, tagType: ItemTagType) {
    return await itemTagRepository.getType(path, tagType);
  }

  async post(member: Member, repositories: Repositories, id: string, tagType: ItemTagType) {
    const { itemTagRepository } = repositories;
    const item = await this.itemService.get(member, repositories, id, PermissionLevel.Admin);
    return { ...(await itemTagRepository.post(member, item, tagType)), item: { path: item.path } };
  }

  async deleteOne(member: Member, repositories: Repositories, id: string, tagType: ItemTagType) {
    const { itemTagRepository } = repositories;
    const item = await this.itemService.get(member, repositories, id, PermissionLevel.Admin);

    await itemTagRepository.deleteOne(item, tagType);
    return { item: { path: item.path } };
  }
}
