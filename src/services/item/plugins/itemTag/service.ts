import { singleton } from 'tsyringe';

import { ItemTagType, PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { Actor, Member } from '../../../member/entities/member';
import { ItemService } from '../../service';

@singleton()
export class ItemTagService {
  private readonly itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async getForItem(actor: Actor, repositories: Repositories, itemId: string) {
    const { itemTagRepository } = repositories;
    const item = await this.itemService.get(actor, repositories, itemId);

    return itemTagRepository.getByItemPath(item.path);
  }

  async getByItemPath({ itemTagRepository }: Repositories, itemPath: string) {
    return itemTagRepository.getByItemPath(itemPath);
  }

  async getForManyItems(actor: Actor, repositories: Repositories, itemIds: string[]) {
    const { itemTagRepository } = repositories;
    const { data, errors } = await this.itemService.getMany(actor, repositories, itemIds);
    const items = Object.values(data);
    if (!items.length) {
      return { data: {}, errors };
    }
    const itemTags = await itemTagRepository.getForManyItems(items);
    return { data: itemTags.data, errors: [...itemTags.errors, ...errors] };
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
