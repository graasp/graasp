import { PermissionLevel } from '@graasp/sdk';

import { UnauthorizedMember } from '../../../../../utils/errors';
import { Repositories } from '../../../../../utils/repositories';
import { validatePermission } from '../../../../authorization';
import { Actor } from '../../../../member/entities/member';
import ItemService from '../../../service';

export class FavoriteService {
  private itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async getOwn(actor: Actor, repositories: Repositories) {
    const { itemFavoriteRepository } = repositories;

    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    return (await itemFavoriteRepository.getFavoriteForMember(actor.id)).filter(
      async (f) =>
        (await validatePermission(repositories, PermissionLevel.Read, actor, f.item)) !== null,
    );
  }

  async post(actor: Actor, repositories: Repositories, itemId: string) {
    const { itemFavoriteRepository } = repositories;

    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    // get and check permissions
    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Read);
    return itemFavoriteRepository.post(item.id, actor.id);
  }

  async delete(actor: Actor, repositories: Repositories, itemId: string) {
    const { itemFavoriteRepository } = repositories;

    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    return itemFavoriteRepository.deleteOne(itemId, actor.id);
  }
}
