import { singleton } from 'tsyringe';

import { PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { filterOutPackedItems } from '../../../authorization';
import { Member } from '../../../member/entities/member';
import { ItemService } from '../../service';
import { PackedItemFavorite } from './entities/ItemFavorite';
import { ItemBookmarkRepository } from './itemBookmark.repository';

@singleton()
export class FavoriteService {
  private readonly itemService: ItemService;
  private readonly itemBookmarkRepository: ItemBookmarkRepository;

  constructor(itemService: ItemService, itemBookmarkRepository: ItemBookmarkRepository) {
    this.itemService = itemService;
    this.itemBookmarkRepository = itemBookmarkRepository;
  }

  async getOwn(db: DBConnection, member: Member): Promise<PackedItemFavorite[]> {
    const favorites = await this.itemBookmarkRepository.getFavoriteForMember(db, member.id);

    // filter out items user might not have access to
    // and packed item
    const filteredItems = await filterOutPackedItems(
      member,
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

  async post(db: DBConnection, member: Member, itemId: string) {
    // get and check permissions
    const item = await this.itemService.get(db, member, itemId, PermissionLevel.Read);
    return this.itemBookmarkRepository.post(db, item.id, member.id);
  }

  async delete(db: DBConnection, member: Member, itemId: string) {
    return this.itemBookmarkRepository.deleteOne(db, itemId, member.id);
  }
}
