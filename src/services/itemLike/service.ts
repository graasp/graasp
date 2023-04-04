import { Repositories } from '../../util/repositories';
import ItemService from '../item/service';
import { Member } from '../member/entities/member';
import { CannotGetOthersLikes } from './errors';

export class ItemLikeService {
  private itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async getItemsForMember(actor: Member, repositories: Repositories, memberId: string) {
    const { itemLikeRepository } = repositories;

    // only own items
    // it might change later
    if (memberId !== actor.id) {
      throw new CannotGetOthersLikes(memberId);
    }

    return itemLikeRepository.getItemsForMember(memberId);
  }

  async getForItem(actor: Member, repositories: Repositories, itemId: string) {
    const { itemLikeRepository } = repositories;

    await this.itemService.get(actor, repositories, itemId);

    return itemLikeRepository.getForItem(itemId);
  }

  async removeOne(actor: Member, repositories: Repositories, itemId: string) {
    const { itemLikeRepository } = repositories;

    // QUESTION: allow public to be liked?
    const item = await this.itemService.get(actor, repositories, itemId);

    return itemLikeRepository.deleteOne(actor, item);
  }

  async post(actor: Member, repositories: Repositories, itemId: string) {
    const { itemLikeRepository } = repositories;

    // QUESTION: allow public to be liked?
    const item = await this.itemService.get(actor, repositories, itemId);
    return itemLikeRepository.post(actor.id, item.id);
  }
}
