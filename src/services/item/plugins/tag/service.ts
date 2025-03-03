import { singleton } from 'tsyringe';

import { PermissionLevel, TagCategory, UUID } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { AuthenticatedUser, MaybeUser } from '../../../../types';
import { TagRepository } from '../../../tag/Tag.repository';
import { ItemService } from '../../service';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemPublishedRepository } from '../publication/published/repositories/itemPublished';
import { ItemTagRepository } from './ItemTag.repository';

@singleton()
export class ItemTagService {
  private readonly itemService: ItemService;
  private readonly meilisearchClient: MeiliSearchWrapper;
  private readonly tagRepository: TagRepository;
  private readonly itemTagRepository: ItemTagRepository;
  private readonly itemPublishedRepository: ItemPublishedRepository;

  constructor(
    itemService: ItemService,
    tagRepository: TagRepository,
    itemTagRepository: ItemTagRepository,
    itemPublishedRepository: ItemPublishedRepository,
    meilisearchClient: MeiliSearchWrapper,
  ) {
    this.itemService = itemService;
    this.meilisearchClient = meilisearchClient;
    this.itemTagRepository = itemTagRepository;
    this.itemPublishedRepository = itemPublishedRepository;
    this.tagRepository = tagRepository;
  }

  async create(
    db: DBConnection,
    authenticatedUser: AuthenticatedUser,
    itemId: UUID,
    tagInfo: { name: string; category: TagCategory },
  ) {
    // Get item and check permission
    const item = await this.itemService.get(
      db,
      authenticatedUser,
      itemId,
      PermissionLevel.Admin,
    );

    // create tag if does not exist
    const tag = await this.tagRepository.addOneIfDoesNotExist(db, tagInfo);

    const result = await this.itemTagRepository.create(db, itemId, tag.id);

    // update index if item is published
    const publishedItem = await this.itemPublishedRepository.getForItem(
      db,
      item.path,
    );
    if (publishedItem) {
      await this.meilisearchClient.indexOne(db, publishedItem);
    }

    return result;
  }

  async getByItemId(db: DBConnection, actor: MaybeUser, itemId: UUID) {
    // Get item and check permission
    await this.itemService.get(db, actor, itemId, PermissionLevel.Read);

    return await this.itemTagRepository.getByItemId(db, itemId);
  }

  async delete(
    db: DBConnection,
    authenticatedUser: AuthenticatedUser,
    itemId: UUID,
    tagId: UUID,
  ) {
    // Get item and check permission
    const item = await this.itemService.get(
      db,
      authenticatedUser,
      itemId,
      PermissionLevel.Admin,
    );

    // update index if item is published
    const publishedItem = await this.itemPublishedRepository.getForItem(
      db,
      item.path,
    );
    if (publishedItem) {
      await this.meilisearchClient.indexOne(db, publishedItem);
    }

    return await this.itemTagRepository.delete(db, itemId, tagId);
  }
}
