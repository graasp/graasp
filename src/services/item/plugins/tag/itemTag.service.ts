import { singleton } from 'tsyringe';

import { PermissionLevel, TagCategory, UUID } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { AuthenticatedUser, MaybeUser } from '../../../../types';
import { TagRepository } from '../../../tag/tag.repository';
import { BasicItemService } from '../../basic.service';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemTagRepository } from './ItemTag.repository';

@singleton()
export class ItemTagService {
  private readonly basicItemService: BasicItemService;
  private readonly meilisearchClient: MeiliSearchWrapper;
  private readonly tagRepository: TagRepository;
  private readonly itemTagRepository: ItemTagRepository;
  private readonly itemPublishedRepository: ItemPublishedRepository;

  constructor(
    basicItemService: BasicItemService,
    tagRepository: TagRepository,
    itemTagRepository: ItemTagRepository,
    itemPublishedRepository: ItemPublishedRepository,
    meilisearchClient: MeiliSearchWrapper,
  ) {
    this.basicItemService = basicItemService;
    this.meilisearchClient = meilisearchClient;
    this.itemTagRepository = itemTagRepository;
    this.itemPublishedRepository = itemPublishedRepository;
    this.tagRepository = tagRepository;
  }

  async create(
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    itemId: UUID,
    tagInfo: { name: string; category: TagCategory },
  ) {
    // Get item and check permission
    const item = await this.basicItemService.get(
      dbConnection,
      authenticatedUser,
      itemId,
      PermissionLevel.Admin,
    );

    // create tag if does not exist
    const tag = await this.tagRepository.addOneIfDoesNotExist(dbConnection, tagInfo);

    const result = await this.itemTagRepository.create(dbConnection, itemId, tag.id);

    // update index if item is published
    const publishedItem = await this.itemPublishedRepository.getForItem(dbConnection, item.path);
    if (publishedItem) {
      await this.meilisearchClient.indexOne(dbConnection, publishedItem);
    }

    return result;
  }

  async getByItemId(dbConnection: DBConnection, actor: MaybeUser, itemId: UUID) {
    // Get item and check permission
    await this.basicItemService.get(dbConnection, actor, itemId, PermissionLevel.Read);

    return await this.itemTagRepository.getByItemId(dbConnection, itemId);
  }

  async delete(
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    itemId: UUID,
    tagId: UUID,
  ) {
    // Get item and check permission
    const item = await this.basicItemService.get(
      dbConnection,
      authenticatedUser,
      itemId,
      PermissionLevel.Admin,
    );

    // update index if item is published
    const publishedItem = await this.itemPublishedRepository.getForItem(dbConnection, item.path);
    if (publishedItem) {
      await this.meilisearchClient.indexOne(dbConnection, publishedItem);
    }

    return await this.itemTagRepository.delete(dbConnection, itemId, tagId);
  }
}
