import { UnauthorizedMember } from '../../../../utils/errors.js';
import { Repositories } from '../../../../utils/repositories.js';
import { filterOutPackedItems } from '../../../authorization.js';
import { ItemService } from '../../../item/service.js';
import { Actor } from '../../../member/entities/member.js';

export class ItemLikeService {
  private itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async getForMember(actor: Actor, repositories: Repositories) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { itemLikeRepository } = repositories;

    // only own items
    // TODO: allow to get other's like?

    const likes = await itemLikeRepository.getForMember(actor.id);
    // filter out items user might not have access to
    // and packed item
    const filteredItems = await filterOutPackedItems(
      actor,
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

    return itemLikeRepository.getForItem(itemId);
  }

  async removeOne(actor: Actor, repositories: Repositories, itemId: string) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { itemLikeRepository } = repositories;

    // QUESTION: allow public to be liked?
    const item = await this.itemService.get(actor, repositories, itemId);

    return itemLikeRepository.deleteOne(actor, item);
  }

  async post(actor: Actor, repositories: Repositories, itemId: string) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { itemLikeRepository } = repositories;

    // QUESTION: allow public to be liked?
    const item = await this.itemService.get(actor, repositories, itemId);
    return itemLikeRepository.post(actor.id, item.id);
  }
}
