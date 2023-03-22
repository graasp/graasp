import { PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../util/repositories';
import { validatePermission } from '../authorization';
import { Member } from '../member/entities/member';
import { CannotGetOthersLikes } from './errors';

export class ItemLikeService {
  async getItemsForMember(actor: Member, repositories: Repositories, memberId: string) {
    const { itemLikeRepository } = repositories;

    // only own items
    // it might change later
    if(memberId !== actor.id) {
      throw new CannotGetOthersLikes(memberId);
    }

    return itemLikeRepository.getItemsForMember(memberId);
  }

  async getForItem(actor: Member, repositories: Repositories, itemId: string) {
    const { itemLikeRepository, itemRepository } = repositories;

    const item = await itemRepository.get(itemId);

    await validatePermission(repositories, PermissionLevel.Read, actor, item);

    return itemLikeRepository.getForItem(actor.id);
  }

  async removeOne(actor: Member, repositories: Repositories, itemId: string) {
    const { itemLikeRepository, itemRepository } = repositories;

    const item = await itemRepository.get(itemId);

    // QUESTION: allow public to be liked?
    await validatePermission(repositories, PermissionLevel.Read, actor, item);

    return itemLikeRepository.deleteOne(actor, item);
  }

  async post(actor: Member, repositories: Repositories, itemId: string) {
    const { itemLikeRepository, itemRepository } = repositories;

    const item = await itemRepository.get(itemId);

    // QUESTION: allow public to be liked?
    await validatePermission(repositories, PermissionLevel.Read, actor, item);
    return itemLikeRepository.post(actor.id, item.id);
  }
}
