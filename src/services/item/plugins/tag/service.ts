import { singleton } from 'tsyringe';

import { PermissionLevel, TagCategory, UUID } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { Actor, Member } from '../../../member/entities/member';
import { ItemService } from '../../service';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';

@singleton()
export class ItemTagService {
  private readonly itemService: ItemService;
  private readonly meilisearchClient: MeiliSearchWrapper;

  constructor(itemService: ItemService, meilisearchClient: MeiliSearchWrapper) {
    this.itemService = itemService;
    this.meilisearchClient = meilisearchClient;
  }

  async create(
    actor: Member,
    repositories: Repositories,
    itemId: UUID,
    tagInfo: { name: string; category: TagCategory },
  ) {
    const { itemTagRepository, tagRepository, itemPublishedRepository } = repositories;

    // Get item and check permission
    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    // create tag if does not exist
    const tag = await tagRepository.addOneIfDoesNotExist(tagInfo);

    const result = await itemTagRepository.create(itemId, tag.id);

    // update index if item is published
    const isPublished = await itemPublishedRepository.getForItem(item);
    if (isPublished) {
      await this.meilisearchClient.indexOne(item, repositories);
    }

    return result;
  }

  async getByItemId(actor: Actor, repositories: Repositories, itemId: UUID) {
    const { itemTagRepository } = repositories;

    // Get item and check permission
    await this.itemService.get(actor, repositories, itemId, PermissionLevel.Read);

    return await itemTagRepository.getByItemId(itemId);
  }

  async delete(actor: Member, repositories: Repositories, itemId: UUID, tagId: UUID) {
    const { itemTagRepository, itemPublishedRepository } = repositories;

    // Get item and check permission
    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    // update index if item is published
    const isPublished = await itemPublishedRepository.getForItem(item);
    if (isPublished) {
      await this.meilisearchClient.indexOne(item, repositories);
    }

    return await itemTagRepository.delete(itemId, tagId);
  }
}
