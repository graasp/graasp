import { singleton } from 'tsyringe';

import { PermissionLevel, TagCategory, UUID } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { Actor, Member } from '../../../member/entities/member';
import { ItemService } from '../../service';

@singleton()
export class ItemTagService {
  private readonly itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async create(
    actor: Member,
    repositories: Repositories,
    itemId: UUID,
    tagInfo: { name: string; category: TagCategory },
  ) {
    const { itemTagRepository, tagRepository } = repositories;

    await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    // create tag if does not exist
    const tag = await tagRepository.addOneIfDoesNotExist(tagInfo);

    const result = await itemTagRepository.create(itemId, tag.id);

    return result;
  }

  async getByItemId(actor: Actor, repositories: Repositories, itemId: UUID) {
    const { itemTagRepository } = repositories;

    // Get item and check permission
    await this.itemService.get(actor, repositories, itemId, PermissionLevel.Read);

    return await itemTagRepository.getByItemId(itemId);
  }

  async delete(actor: Member, repositories: Repositories, itemId: UUID, tagId: UUID) {
    const { itemTagRepository } = repositories;

    await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    return await itemTagRepository.delete(itemId, tagId);
  }
}
