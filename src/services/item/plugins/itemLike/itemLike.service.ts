import { singleton } from 'tsyringe';

import { type DBConnection } from '../../../../drizzle/db';
import { MaybeUser, MinimalMember } from '../../../../types';
import { filterOutPackedItems } from '../../../authorization.utils';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemLikeRepository } from './itemLike.repository';

@singleton()
export class ItemLikeService {
  private readonly authorizedItemService: AuthorizedItemService;
  private itemLikeRepository: ItemLikeRepository;
  private itemPublishedRepository: ItemPublishedRepository;
  private readonly meilisearchClient: MeiliSearchWrapper;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly itemVisibilityRepository: ItemVisibilityRepository;

  constructor(
    authorizedItemService: AuthorizedItemService,
    itemLikeRepository: ItemLikeRepository,
    itemPublishedRepository: ItemPublishedRepository,
    itemMembershipRepository: ItemMembershipRepository,
    itemVisibilityRepository: ItemVisibilityRepository,
    meilisearchClient: MeiliSearchWrapper,
  ) {
    this.authorizedItemService = authorizedItemService;
    this.itemLikeRepository = itemLikeRepository;
    this.itemPublishedRepository = itemPublishedRepository;
    this.meilisearchClient = meilisearchClient;
    this.itemMembershipRepository = itemMembershipRepository;
    this.itemVisibilityRepository = itemVisibilityRepository;
  }

  async getForMember(dbConnection: DBConnection, member: MinimalMember) {
    // only own items
    const likes = await this.itemLikeRepository.getByCreator(dbConnection, member.id);
    // filter out items user might not have access to
    // and packed item
    const filteredItems = await filterOutPackedItems(
      dbConnection,
      member,
      {
        itemMembershipRepository: this.itemMembershipRepository,
        itemVisibilityRepository: this.itemVisibilityRepository,
      },
      likes.map(({ item }) => item),
    );
    return filteredItems.map((item) => {
      const like = likes.find(({ item: i }) => i.id === item.id);
      return { ...like, item };
    });
  }

  async getForItem(dbConnection: DBConnection, actor: MaybeUser, itemId: string) {
    await this.authorizedItemService.hasPermissionForItemId(dbConnection, { actor, itemId });

    return this.itemLikeRepository.getByItemId(dbConnection, itemId);
  }

  async removeOne(dbConnection: DBConnection, member: MinimalMember, itemId: string) {
    // QUESTION: allow public to be liked?
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      actor: member,
      itemId,
    });

    const result = await this.itemLikeRepository.deleteOneByCreatorAndItem(
      dbConnection,
      member.id,
      item.id,
    );

    // update index if item is published
    const publishedItem = await this.itemPublishedRepository.getForItem(dbConnection, item.path);
    if (publishedItem) {
      const likes = await this.itemLikeRepository.getCountByItemId(dbConnection, item.id);
      await this.meilisearchClient.updateItem(item.id, { likes });
    }

    return result;
  }

  async post(dbConnection: DBConnection, member: MinimalMember, itemId: string) {
    // QUESTION: allow public to be liked?
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      actor: member,
      itemId,
    });
    const result = await this.itemLikeRepository.addOne(dbConnection, {
      creatorId: member.id,
      itemId: item.id,
    });

    // update index if item is published
    const publishedItem = await this.itemPublishedRepository.getForItem(dbConnection, item.path);
    if (publishedItem) {
      const likes = await this.itemLikeRepository.getCountByItemId(dbConnection, item.id);
      await this.meilisearchClient.updateItem(item.id, { likes });
    }

    return result;
  }
}
