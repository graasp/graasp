import { ItemTagType, PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../util/repositories';
import ItemService from '../item/service';
import { Member } from '../member/entities/member';

export class ItemTagService {
  private itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async getForItem(actor: Member, repositories: Repositories, itemId: string) {
    const { itemTagRepository } = repositories;
    const item = await this.itemService.get(actor, repositories, itemId);

    return itemTagRepository.getForItem(item);
  }
  async getForManyItems(actor: Member, repositories: Repositories, itemIds: string[]) {
    const { itemTagRepository } = repositories;
    const { data, errors } = await this.itemService.getMany(actor, repositories, itemIds);
    const items = Object.values(data);
    const itemTags = await itemTagRepository.getForManyItems(items);
    return { data: itemTags.data, errors: [...itemTags.errors, errors] };
  }

  async has(actor: Member, repositories: Repositories, id: string, tagType: ItemTagType) {
    const { itemTagRepository } = repositories;
    const item = await this.itemService.get(actor, repositories, id);

    return itemTagRepository.getType(item, tagType);
  }

  async post(actor: Member, repositories: Repositories, id: string, tagType: ItemTagType) {
    const { itemTagRepository } = repositories;
    const item = await this.itemService.get(actor, repositories, id, PermissionLevel.Admin);

    return itemTagRepository.post(actor, item, tagType);
  }

  async deleteOne(actor: Member, repositories: Repositories, id: string, tagType: ItemTagType) {
    const { itemTagRepository } = repositories;
    const item = await this.itemService.get(actor, repositories, id, PermissionLevel.Admin);

    await itemTagRepository.deleteOne(item, tagType);
  }
}
