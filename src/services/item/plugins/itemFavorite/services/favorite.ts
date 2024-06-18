import { PermissionLevel } from '@graasp/sdk';

import { UnauthorizedMember } from '../../../../../utils/errors.js';
import { Repositories } from '../../../../../utils/repositories.js';
import { filterOutPackedItems } from '../../../../authorization.js';
import { Actor } from '../../../../member/entities/member.js';
import { ItemService } from '../../../service.js';
import { PackedItemFavorite } from '../entities/ItemFavorite.js';

export class FavoriteService {
  private itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async getOwn(actor: Actor, repositories: Repositories): Promise<PackedItemFavorite[]> {
    const { itemFavoriteRepository } = repositories;

    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    const favorites = await itemFavoriteRepository.getFavoriteForMember(actor.id);

    // filter out items user might not have access to
    // and packed item
    const filteredItems = await filterOutPackedItems(
      actor,
      repositories,
      favorites.map(({ item }) => item),
    );

    // insert back packed item inside favorite entities
    return filteredItems.map((item) => {
      const fav = favorites.find(({ item: i }) => i.id === item.id);
      // should never pass here
      if (!fav) {
        throw new Error(`favorite should be defined`);
      }
      return { ...fav, item };
    });
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
