import { UnauthorizedMember } from '../../utils/errors';
import { Repositories } from '../../utils/repositories';
import ItemService from '../item/service';
import { Actor } from '../member/entities/member';
import { CannotGetOthersLikes } from './errors';

export class ItemLikeService {
  private itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async getItemsForMember(actor: Actor, repositories: Repositories, memberId: string) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { itemLikeRepository } = repositories;

    // only own items
    // TODO: allow with future implementation 
    if (memberId !== actor.id) {
      throw new CannotGetOthersLikes(memberId);
    }

    return itemLikeRepository.getItemsForMember(memberId);
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
