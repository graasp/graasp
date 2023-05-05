import { ItemTagType, PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { Actor } from '../../../member/entities/member';
import ItemService from '../../service';

export class ItemTagService {
  private itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async getForItem(actor: Actor, repositories: Repositories, itemId: string) {
    const { itemTagRepository } = repositories;
    const item = await this.itemService.get(actor, repositories, itemId);

    return itemTagRepository.getForItem(item);
  }
  async getForManyItems(actor: Actor, repositories: Repositories, itemIds: string[]) {
    const { itemTagRepository } = repositories;
    const { data, errors } = await this.itemService.getMany(actor, repositories, itemIds);
    const items = Object.values(data);
    const itemTags = await itemTagRepository.getForManyItems(items);
    return { data: itemTags.data, errors: [...itemTags.errors, ...errors] };
  }

  async has(actor: Actor, repositories: Repositories, id: string, tagType: ItemTagType) {
    const { itemTagRepository } = repositories;
    const item = await this.itemService.get(actor, repositories, id);

    return itemTagRepository.getType(item, tagType);
  }

  async post(actor: Actor, repositories: Repositories, id: string, tagType: ItemTagType) {
    if (!actor) {
      throw new Error('actor does not exist');
    }

    const { itemTagRepository } = repositories;
    const item = await this.itemService.get(actor, repositories, id, PermissionLevel.Admin);

    return itemTagRepository.post(actor, item, tagType);
  }

  async deleteOne(actor: Actor, repositories: Repositories, id: string, tagType: ItemTagType) {
    if (!actor) {
      throw new Error('actor does not exist');
    }

    const { itemTagRepository } = repositories;
    const item = await this.itemService.get(actor, repositories, id, PermissionLevel.Admin);

    await itemTagRepository.deleteOne(item, tagType);
  }
}
