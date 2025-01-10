import { singleton } from 'tsyringe';

import { Repositories } from '../../../../utils/repositories';
import { filterOutPackedItems } from '../../../authorization';
import { ItemService } from '../../../item/service';
import { Actor, Member } from '../../../member/entities/member';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';

@singleton()
export class ItemLikeService {
  private itemService: ItemService;
  private readonly meilisearchClient: MeiliSearchWrapper;

  constructor(itemService: ItemService, meilisearchClient: MeiliSearchWrapper) {
    this.itemService = itemService;
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

  async removeOne(member: Member, repositories: Repositories, itemId: string) {
    const { itemLikeRepository, itemPublishedRepository } = repositories;

    // QUESTION: allow public to be liked?
    const item = await this.itemService.get(member, repositories, itemId);

    const result = await itemLikeRepository.deleteOneByCreatorAndItem(member.id, item.id);

    // update index if item is published
    const isPublished = await itemPublishedRepository.getForItem(item);
    if (isPublished) {
      const likes = await itemLikeRepository.getCountByItemId(item.id);
      await this.meilisearchClient.updateItem(item.id, { likes });
    }

    return result;
  }

  async post(member: Member, repositories: Repositories, itemId: string) {
    const { itemLikeRepository, itemPublishedRepository } = repositories;

    // QUESTION: allow public to be liked?
    const item = await this.itemService.get(member, repositories, itemId);
    const result = await itemLikeRepository.addOne({ creatorId: member.id, itemId: item.id });

    // update index if item is published
    const isPublished = await itemPublishedRepository.getForItem(item);
    if (isPublished) {
      const likes = await itemLikeRepository.getCountByItemId(item.id);
      await this.meilisearchClient.updateItem(item.id, { likes });
    }

    return result;
  }
}
