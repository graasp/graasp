import { singleton } from 'tsyringe';

import { type DBConnection } from '../../../../drizzle/db';
import type { ItemBookmarkRaw } from '../../../../drizzle/types';
import type { MinimalMember } from '../../../../types';
import { filterOutPackedItems } from '../../../authorization.utils';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import type { PackedItem } from '../../ItemWrapper';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository';
import { ItemBookmarkRepository } from './itemBookmark.repository';

type PackedBookmarkedItem = ItemBookmarkRaw & { item: PackedItem };

@singleton()
export class BookmarkService {
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly itemBookmarkRepository: ItemBookmarkRepository;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly itemVisibilityRepository: ItemVisibilityRepository;

  constructor(
    authorizedItemService: AuthorizedItemService,
    itemBookmarkRepository: ItemBookmarkRepository,
    itemMembershipRepository: ItemMembershipRepository,
    itemVisibilityRepository: ItemVisibilityRepository,
  ) {
    this.authorizedItemService = authorizedItemService;
    this.itemBookmarkRepository = itemBookmarkRepository;
    this.itemMembershipRepository = itemMembershipRepository;
    this.itemVisibilityRepository = itemVisibilityRepository;
  }

  async getOwn(dbConnection: DBConnection, member: MinimalMember): Promise<PackedBookmarkedItem[]> {
    const bookmarks = await this.itemBookmarkRepository.getBookmarksForMember(
      dbConnection,
      member.id,
    );

    // filter out items user might not have access to
    // and packed item
    const filteredItems = await filterOutPackedItems(
      dbConnection,
      member,
      {
        itemMembershipRepository: this.itemMembershipRepository,
        itemVisibilityRepository: this.itemVisibilityRepository,
      },
      bookmarks.map(({ item }) => item),
    );

    // insert back packed item inside bookmark entities
    return filteredItems.map((item) => {
      const bookmark = bookmarks.find(({ item: i }) => i.id === item.id);
      // should never pass here
      if (!bookmark) {
        throw new Error(`bookmark should be defined`);
      }
      return { ...bookmark, item };
    });
  }

  async post(dbConnection: DBConnection, member: MinimalMember, itemId: string) {
    // get and check permissions
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: member.id,
      itemId,
      permission: 'read',
    });
    await this.itemBookmarkRepository.post(dbConnection, item.id, member.id);
  }

  async delete(dbConnection: DBConnection, member: MinimalMember, itemId: string) {
    return this.itemBookmarkRepository.deleteOne(dbConnection, itemId, member.id);
  }
}
