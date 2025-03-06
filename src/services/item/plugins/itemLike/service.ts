import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../drizzle/db';
import { MaybeUser, MinimalMember } from '../../../../types';
import { filterOutPackedItems } from '../../../authorization';
import { ItemService } from '../../../item/service';
import { ItemMembershipRepository } from '../../../itemMembership/repository';
import { ItemVisibilityRepository } from '../itemVisibility/repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemLikeRepository } from './repository';

@singleton()
export class ItemLikeService {
  private itemService: ItemService;
  private itemLikeRepository: ItemLikeRepository;
  private itemPublishedRepository: ItemPublishedRepository;
  private readonly meilisearchClient: MeiliSearchWrapper;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly itemVisibilityRepository: ItemVisibilityRepository;

  constructor(
    itemService: ItemService,
    itemLikeRepository: ItemLikeRepository,
    itemPublishedRepository: ItemPublishedRepository,
    itemMembershipRepository: ItemMembershipRepository,
    itemVisibilityRepository: ItemVisibilityRepository,
    meilisearchClient: MeiliSearchWrapper,
  ) {
    this.itemService = itemService;
    this.itemLikeRepository = itemLikeRepository;
    this.itemPublishedRepository = itemPublishedRepository;
    this.meilisearchClient = meilisearchClient;
    this.itemMembershipRepository = itemMembershipRepository;
    this.itemVisibilityRepository = itemVisibilityRepository;
  }

  async getForMember(db: DBConnection, member: MinimalMember) {
    // only own items
    // TODO: allow to get other's like?

    const likes = await this.itemLikeRepository.getByCreator(db, member.id);
    // filter out items user might not have access to
    // and packed item
    const filteredItems = await filterOutPackedItems(
      db,
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

  async getForItem(db: DBConnection, actor: MaybeUser, itemId: string) {
    await this.itemService.get(db, actor, itemId);

    return this.itemLikeRepository.getByItemId(db, itemId);
  }

  async removeOne(db: DBConnection, member: MinimalMember, itemId: string) {
    // QUESTION: allow public to be liked?
    const item = await this.itemService.get(db, member, itemId);

    const result = await this.itemLikeRepository.deleteOneByCreatorAndItem(db, member.id, item.id);

    // update index if item is published
    const publishedItem = await this.itemPublishedRepository.getForItem(db, item.path);
    if (publishedItem) {
      const likes = await this.itemLikeRepository.getCountByItemId(db, item.id);
      await this.meilisearchClient.updateItem(item.id, { likes });
    }

    return result;
  }

  async post(db: DBConnection, member: MinimalMember, itemId: string) {
    // QUESTION: allow public to be liked?
    const item = await this.itemService.get(db, member, itemId);
    const result = await this.itemLikeRepository.addOne(db, {
      creatorId: member.id,
      itemId: item.id,
    });

    // update index if item is published
    const publishedItem = await this.itemPublishedRepository.getForItem(db, item.path);
    if (publishedItem) {
      const likes = await this.itemLikeRepository.getCountByItemId(db, item.id);
      await this.meilisearchClient.updateItem(item.id, { likes });
    }

    return result;
  }
}
