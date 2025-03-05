import { singleton } from 'tsyringe';

import { PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { MinimalMember } from '../../../../types';
import { filterOutPackedItems } from '../../../authorization';
import { ItemMembershipRepository } from '../../../itemMembership/repository';
import { ItemService } from '../../service';
import { ItemVisibilityRepository } from '../itemVisibility/repository';
import { ItemBookmarkRepository } from './itemBookmark.repository';

@singleton()
export class FavoriteService {
  private readonly itemService: ItemService;
  private readonly itemBookmarkRepository: ItemBookmarkRepository;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly itemVisibilityRepository: ItemVisibilityRepository;

  constructor(
    itemService: ItemService,
    itemBookmarkRepository: ItemBookmarkRepository,
    itemMembershipRepository: ItemMembershipRepository,
    itemVisibilityRepository: ItemVisibilityRepository,
  ) {
    this.itemService = itemService;
    this.itemBookmarkRepository = itemBookmarkRepository;
    this.itemMembershipRepository = itemMembershipRepository;
    this.itemVisibilityRepository = itemVisibilityRepository;
  }

  async getOwn(db: DBConnection, member: MinimalMember): Promise<PackedItemFavorite[]> {
    const favorites = await this.itemBookmarkRepository.getFavoriteForMember(db, member.id);

    // filter out items user might not have access to
    // and packed item
    const filteredItems = await filterOutPackedItems(
      db,
      member,
      {
        itemMembershipRepository: this.itemMembershipRepository,
        itemVisibilityRepository: this.itemVisibilityRepository,
      },
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

  async post(db: DBConnection, member: MinimalMember, itemId: string) {
    // get and check permissions
    const item = await this.itemService.get(db, member, itemId, PermissionLevel.Read);
    return this.itemBookmarkRepository.post(db, item.id, member.id);
  }

  async delete(db: DBConnection, member: MinimalMember, itemId: string) {
    return this.itemBookmarkRepository.deleteOne(db, itemId, member.id);
  }
}
