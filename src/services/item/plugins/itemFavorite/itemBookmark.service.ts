import { singleton } from 'tsyringe';

import { PermissionLevel } from '@graasp/sdk';

import { db } from '../../../../drizzle/db';
import { Repositories } from '../../../../utils/repositories';
import { filterOutPackedItems } from '../../../authorization';
import { Member } from '../../../member/entities/member';
import { ItemService } from '../../service';
import { PackedItemFavorite } from './entities/ItemFavorite';
import { ItemBookmarkRepository } from './itemBookmark.repository';

@singleton()
export class FavoriteService {
  private itemService: ItemService;
  private itemBookmarkRepository: ItemBookmarkRepository;

  constructor(itemService: ItemService, itemBookmarkRepository: ItemBookmarkRepository) {
    this.itemService = itemService;
    this.itemBookmarkRepository = itemBookmarkRepository;
  }

  async getOwn(member: Member): Promise<PackedItemFavorite[]> {
    const favorites = await this.itemBookmarkRepository.getFavoriteForMember(db, member.id);

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
