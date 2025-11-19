import { singleton } from 'tsyringe';

import { PermissionLevel, type TagCategoryType, type UUID } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import type { AuthenticatedUser, MaybeUser } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { TagRepository } from '../../../tag/tag.repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemTagRepository } from './itemTag.repository';

@singleton()
export class ItemTagService {
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly meilisearchClient: MeiliSearchWrapper;
  private readonly tagRepository: TagRepository;
  private readonly itemTagRepository: ItemTagRepository;
  private readonly itemPublishedRepository: ItemPublishedRepository;

  constructor(
    authorizedItemService: AuthorizedItemService,
    tagRepository: TagRepository,
    itemTagRepository: ItemTagRepository,
    itemPublishedRepository: ItemPublishedRepository,
    meilisearchClient: MeiliSearchWrapper,
  ) {
    this.authorizedItemService = authorizedItemService;
    this.meilisearchClient = meilisearchClient;
    this.itemTagRepository = itemTagRepository;
    this.itemPublishedRepository = itemPublishedRepository;
    this.tagRepository = tagRepository;
  }

  async create(
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    itemId: UUID,
    tagInfo: { name: string; category: TagCategoryType },
  ) {
    // Get item and check permission
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: authenticatedUser.id,
      itemId,
      permission: PermissionLevel.Admin,
    });

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

  async getByItemId(dbConnection: DBConnection, maybeUser: MaybeUser, itemId: UUID) {
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: maybeUser?.id,
      itemId,
    });

    return await this.itemTagRepository.getByItemId(dbConnection, itemId);
  }

  async delete(
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    itemId: UUID,
    tagId: UUID,
  ) {
    // Get item and check permission
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: authenticatedUser.id,
      itemId,
      permission: PermissionLevel.Admin,
    });

    // update index if item is published
    const publishedItem = await this.itemPublishedRepository.getForItem(dbConnection, item.path);
    if (publishedItem) {
      await this.meilisearchClient.indexOne(dbConnection, publishedItem);
    }

    return await this.itemTagRepository.delete(dbConnection, itemId, tagId);
  }
}
