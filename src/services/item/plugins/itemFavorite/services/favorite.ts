import { singleton } from 'tsyringe';

import { PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../../../utils/repositories';
import { filterOutPackedItems } from '../../../../authorization';
import { Member } from '../../../../member/entities/member';
import { ItemService } from '../../../service';
import { PackedItemFavorite } from '../entities/ItemFavorite';

@singleton()
export class FavoriteService {
  private itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async getOwn(member: Member, repositories: Repositories): Promise<PackedItemFavorite[]> {
    const { itemFavoriteRepository } = repositories;

    const favorites = await itemFavoriteRepository.getFavoriteForMember(member.id);

    // filter out items user might not have access to
    // and packed item
    const filteredItems = await filterOutPackedItems(
      member,
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

  async post(member: Member, repositories: Repositories, itemId: string) {
    const { itemFavoriteRepository } = repositories;

    // get and check permissions
    const item = await this.itemService.get(member, repositories, itemId, PermissionLevel.Read);
    return itemFavoriteRepository.post(item.id, member.id);
  }

  async delete(member: Member, repositories: Repositories, itemId: string) {
    const { itemFavoriteRepository } = repositories;

    return itemFavoriteRepository.deleteOne(itemId, member.id);
  }
}
