import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../drizzle/db';
import { Repositories } from '../../../../utils/repositories';
import { filterOutPackedItems } from '../../../authorization';
import { ItemService } from '../../../item/service';
import { Actor, Member } from '../../../member/entities/member';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemLikeRepository } from './repository';

@singleton()
export class ItemLikeService {
  private itemService: ItemService;
  private itemLikeRepository: ItemLikeRepository;
  private readonly meilisearchClient: MeiliSearchWrapper;

  constructor(
    itemService: ItemService,
    itemLikeRepository: ItemLikeRepository,
    meilisearchClient: MeiliSearchWrapper,
  ) {
    this.itemService = itemService;
    this.itemLikeRepository = itemLikeRepository;
    this.meilisearchClient = meilisearchClient;
  }

  async getForMember(member: Member, repositories: Repositories) {
    const { itemLikeRepository } = repositories;

    // only own items
    // TODO: allow to get other's like?

    const likes = await itemLikeRepository.getByCreator(member.id);
    // filter out items user might not have access to
    // and packed item
    const filteredItems = await filterOutPackedItems(
      member,
      repositories,
      likes.map(({ item }) => item),
    );
    return filteredItems.map((item) => {
      const like = likes.find(({ item: i }) => i.id === item.id);
      return { ...like, item };
    });
  }

  async getForItem(actor: Actor, repositories: Repositories, itemId: string) {
    const { itemLikeRepository } = repositories;

    await this.itemService.get(actor, repositories, itemId);

    return itemLikeRepository.getByItemId(itemId);
  }

  async removeOne(db: DBConnection, member: Member, itemId: string) {
    const { itemPublishedRepository } = repositories;

    // QUESTION: allow public to be liked?
    const item = await this.itemService.get(member, repositories, itemId);

    const result = await this.itemLikeRepository.deleteOneByCreatorAndItem(db, member.id, item.id);

    // update index if item is published
    const publishedItem = await itemPublishedRepository.getForItem(item);
    if (publishedItem) {
      const likes = await this.itemLikeRepository.getCountByItemId(item.id);
      await this.meilisearchClient.updateItem(item.id, { likes });
    }

    return result;
  }

  async post(db: DBConnection, member: Member, repositories: Repositories, itemId: string) {
    const { itemPublishedRepository } = repositories;

    // QUESTION: allow public to be liked?
    const item = await this.itemService.get(member, repositories, itemId);
    const result = await this.itemLikeRepository.addOne(db, {
      creatorId: member.id,
      itemId: item.id,
    });

    // update index if item is published
    const publishedItem = await itemPublishedRepository.getForItem(item);
    if (publishedItem) {
      const likes = await this.itemLikeRepository.getCountByItemId(item.id);
      await this.meilisearchClient.updateItem(item.id, { likes });
    }

    return result;
  }
}
