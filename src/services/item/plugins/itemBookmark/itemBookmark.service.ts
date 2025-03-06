import { singleton } from 'tsyringe';

import { PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { ItemBookmarkRaw } from '../../../../drizzle/types';
import { MinimalMember } from '../../../../types';
import { filterOutPackedItems } from '../../../authorization';
import { ItemMembershipRepository } from '../../../itemMembership/repository';
import { PackedItem } from '../../ItemWrapper';
import { BasicItemService } from '../../basic.service';
import { ItemService } from '../../service';
import { ItemVisibilityRepository } from '../itemVisibility/repository';
import { ItemBookmarkRepository } from './itemBookmark.repository';

type PackedBookmarkedItem = ItemBookmarkRaw & { item: PackedItem };

@singleton()
export class BookmarkService {
  private readonly basicItemService: BasicItemService;
  private readonly itemBookmarkRepository: ItemBookmarkRepository;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly itemVisibilityRepository: ItemVisibilityRepository;

  constructor(
    basicItemService: BasicItemService,
    itemBookmarkRepository: ItemBookmarkRepository,
    itemMembershipRepository: ItemMembershipRepository,
    itemVisibilityRepository: ItemVisibilityRepository,
  ) {
    this.basicItemService = basicItemService;
    this.itemBookmarkRepository = itemBookmarkRepository;
    this.itemMembershipRepository = itemMembershipRepository;
    this.itemVisibilityRepository = itemVisibilityRepository;
  }

  async getOwn(db: DBConnection, member: MinimalMember): Promise<PackedBookmarkedItem[]> {
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
    const item = await this.basicItemService.get(db, member, itemId, PermissionLevel.Read);
    return this.itemBookmarkRepository.post(db, item.id, member.id);
  }

  async delete(db: DBConnection, member: MinimalMember, itemId: string) {
    return this.itemBookmarkRepository.deleteOne(db, itemId, member.id);
  }
}
