import { singleton } from 'tsyringe';

import { ItemVisibilityType, type ResultOf, type ThumbnailsBySize } from '@graasp/sdk';

import type { DBConnection } from '../../drizzle/db';
import type {
  ItemMembershipRaw,
  ItemVisibilityRaw,
  ItemWithCreator,
  MinimalAccount,
} from '../../drizzle/types';
import { ItemMembershipRepository } from '../itemMembership/membership.repository';
import { Item, resolveItemType } from './item';
import { ItemVisibilityRepository } from './plugins/itemVisibility/itemVisibility.repository';
import { ItemThumbnailService } from './plugins/thumbnail/itemThumbnail.service';
import type { ItemsThumbnails } from './plugins/thumbnail/types';

export type PackedItem = Item & {
  creator: MinimalAccount | null;
  // permission can be undefined because the item is public
  permission: ItemMembershipRaw['permission'] | null;
  hidden?: ItemVisibilityRaw;
  public?: ItemVisibilityRaw;
  thumbnails?: ThumbnailsBySize;
};

export const getCreator = (creator: MinimalAccount | null): MinimalAccount | null => {
  if (!creator) {
    return null;
  }
  return {
    id: creator.id,
    name: creator.name,
  };
};

export class PackedItemDTO {
  item: ItemWithCreator;
  actorPermission?: { permission: ItemMembershipRaw['permission'] } | null;
  visibilities?: ItemVisibilityRaw[] | null;
  private readonly thumbnails?: ThumbnailsBySize;

  constructor(
    item: ItemWithCreator,
    im?: { permission: ItemMembershipRaw['permission'] } | null,
    visibilities?: ItemVisibilityRaw[] | null,
    thumbnails?: ThumbnailsBySize,
  ) {
    this.item = item;
    this.actorPermission = im;
    this.visibilities = visibilities;
    this.thumbnails = thumbnails;
  }

  /**
   * build item unit with complementary info, such as permission
   * @returns item unit with permission
   */
  packed(): PackedItem {
    // sort visibilities to retrieve the most restrictive (highest) visibility first
    if (this.visibilities) {
      this.visibilities.sort((a, b) => (a.itemPath.length > b.itemPath.length ? 1 : -1));
    }

    return {
      ...resolveItemType(this.item),
      creator: getCreator(this.item.creator),
      permission: this.actorPermission?.permission ?? null,
      hidden: this.visibilities?.find((t) => t.type === ItemVisibilityType.Hidden),
      public: this.visibilities?.find((t) => t.type === ItemVisibilityType.Public),
      thumbnails: this.thumbnails,
    };
  }
}

@singleton()
export class PackedItemService {
  private readonly itemVisibilityRepository: ItemVisibilityRepository;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly itemThumbnailService: ItemThumbnailService;

  constructor(
    itemVisibilityRepository: ItemVisibilityRepository,
    itemMembershipRepository: ItemMembershipRepository,
    itemThumbnailService: ItemThumbnailService,
  ) {
    this.itemVisibilityRepository = itemVisibilityRepository;
    this.itemMembershipRepository = itemMembershipRepository;
    this.itemThumbnailService = itemThumbnailService;
  }

  /**
   * merge items and their permission in a result of structure
   * @param items result of many items
   * @param memberships result memberships for many items
   * @returns ResultOf<PackedItem>
   */
  mergeResult(
    items: ItemWithCreator[],
    memberships: ResultOf<ItemMembershipRaw | null>,
    visibilities?: ResultOf<ItemVisibilityRaw[] | null>,
    itemsThumbnails?: ItemsThumbnails,
  ): ResultOf<PackedItem> {
    const data: ResultOf<PackedItem>['data'] = {};

    for (const i of items) {
      const { permission = null } = memberships.data[i.id] ?? {};
      const thumbnails = itemsThumbnails?.[i.id];

      // sort visibilities to retrieve the most restrictive (highest) visibility first
      const itemVisibilities = visibilities?.data?.[i.id];
      if (itemVisibilities) {
        itemVisibilities.sort((a, b) => (a.itemPath.length > b.itemPath.length ? 1 : -1));
      }

      data[i.id] = {
        ...resolveItemType(i),
        creator: getCreator(i),
        permission,
        hidden: itemVisibilities?.find((t) => t.type === ItemVisibilityType.Hidden),
        public: itemVisibilities?.find((t) => t.type === ItemVisibilityType.Public),
        ...(thumbnails ? { thumbnails } : {}),
      };
    }

    return { data, errors: [...memberships.errors] };
  }

  async createPackedItems(
    dbConnection: DBConnection,
    items: ItemWithCreator[],
    memberships?: ResultOf<ItemMembershipRaw[]>,
  ): Promise<PackedItem[]> {
    // no items, so nothing to fetch
    if (!items.length) {
      return [];
    }

    const visibilities = await this.itemVisibilityRepository.getForManyItems(dbConnection, items);

    const m =
      memberships ?? (await this.itemMembershipRepository.getForManyItems(dbConnection, items));

    const itemsThumbnails = await this.itemThumbnailService.getUrlsByItems(items);

    return items.map((item) => {
      const permission = m.data[item.id][0]?.permission;
      const thumbnails = itemsThumbnails[item.id];

      // sort visibilities to retrieve the most restrictive (highest) visibility first
      const itemVisibilities = visibilities?.data?.[item.id] ?? [];
      if (itemVisibilities) {
        itemVisibilities.sort((a, b) => (a.item.path.length > b.item.path.length ? 1 : -1));
      }

      return {
        ...resolveItemType(item),
        creator: getCreator(item.creator),
        permission,
        hidden: itemVisibilities.find((t) => t.type === ItemVisibilityType.Hidden),
        public: itemVisibilities.find((t) => t.type === ItemVisibilityType.Public),
        ...(thumbnails ? { thumbnails } : {}),
      };
    });
  }
}
