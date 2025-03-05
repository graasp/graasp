import { singleton } from 'tsyringe';

import { ItemVisibilityType, ResultOf, ThumbnailsBySize } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import {
  Account,
  Item,
  ItemMembershipRaw,
  ItemVisibilityWithItem,
  ItemWithCreator,
} from '../../drizzle/types';
import { ItemMembershipRepository } from '../itemMembership/repository';
import { ItemVisibilityRepository } from './plugins/itemVisibility/repository';
import { ItemThumbnailService } from './plugins/thumbnail/service';
import { ItemsThumbnails } from './plugins/thumbnail/types';

type GraaspItem = Pick<
  Item,
  | 'id'
  | 'name'
  | 'type'
  | 'path'
  | 'description'
  | 'extra'
  | 'createdAt'
  | 'updatedAt'
  | 'settings'
  | 'lang'
> & {
  creator: Account;
  // TODO: purposely remove geolocation -> lets create a new endpoint
  // geolocation: string
};

export type PackedItem = GraaspItem & {
  // permission can be undefined because the item is public
  permission: ItemMembershipRaw['permission'] | null;
  hidden?: ItemVisibilityWithItem;
  public?: ItemVisibilityWithItem;
  thumbnails?: ThumbnailsBySize;
};

export class ItemWrapper {
  item: ItemWithCreator;
  actorPermission?: { permission: ItemMembershipRaw['permission'] } | null;
  visibilities?: ItemVisibilityWithItem[] | null;
  private readonly thumbnails?: ThumbnailsBySize;

  constructor(
    item: ItemWithCreator,
    im?: { permission: ItemMembershipRaw['permission'] } | null,
    visibilities?: ItemVisibilityWithItem[] | null,
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
      this.visibilities.sort((a, b) => (a.item.path.length > b.item.path.length ? 1 : -1));
    }

    return {
      ...this.item,
      permission: this.actorPermission?.permission ?? null,
      hidden: this.visibilities?.find((t) => t.type === ItemVisibilityType.Hidden),
      public: this.visibilities?.find((t) => t.type === ItemVisibilityType.Public),
      thumbnails: this.thumbnails,
    };
  }
}

@singleton()
export class ItemWrapperService {
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
   * @returns PackedItem[]
   */
  merge(
    items: ItemWithCreator[],
    memberships: ResultOf<ItemMembershipRaw | null>,
    visibilities?: ResultOf<ItemVisibilityWithItem[] | null>,
    itemsThumbnails?: ItemsThumbnails,
  ): PackedItem[] {
    const data: PackedItem[] = [];

    for (const i of items) {
      const { permission = null } = memberships.data[i.id] ?? {};
      const thumbnails = itemsThumbnails?.[i.id];

      // sort visibilities to retrieve the most restrictive (highest) visibility first
      const itemVisibilities = visibilities?.data?.[i.id];
      if (itemVisibilities) {
        itemVisibilities.sort((a, b) => (a.item.path.length > b.item.path.length ? 1 : -1));
      }

      data.push({
        ...i,
        permission,
        hidden: itemVisibilities?.find((t) => t.type === ItemVisibilityType.Hidden),
        public: itemVisibilities?.find((t) => t.type === ItemVisibilityType.Public),
        ...(thumbnails ? { thumbnails } : {}),
      });
    }

    return data;
  }

  /**
   * merge items and their permission in a result of structure
   * @param items result of many items
   * @param memberships result memberships for many items
   * @returns ResultOf<PackedItem>
   */
  mergeResult(
    items: ResultOf<Item>,
    memberships: ResultOf<ItemMembershipRaw | null>,
    visibilities?: ResultOf<ItemVisibilityWithItem[] | null>,
    itemsThumbnails?: ItemsThumbnails,
  ): ResultOf<PackedItem> {
    const data: ResultOf<PackedItem>['data'] = {};

    for (const i of Object.values(items.data)) {
      const { permission = null } = memberships.data[i.id] ?? {};
      const thumbnails = itemsThumbnails?.[i.id];

      // sort visibilities to retrieve the most restrictive (highest) visibility first
      const itemVisibilities = visibilities?.data?.[i.id];
      if (itemVisibilities) {
        itemVisibilities.sort((a, b) => (a.item.path.length > b.item.path.length ? 1 : -1));
      }

      data[i.id] = {
        ...i,
        permission,
        hidden: itemVisibilities?.find((t) => t.type === ItemVisibilityType.Hidden),
        public: itemVisibilities?.find((t) => t.type === ItemVisibilityType.Public),
        ...(thumbnails ? { thumbnails } : {}),
      };
    }

    return { data, errors: [...items.errors, ...memberships.errors] };
  }

  async createPackedItems(
    db: DBConnection,
    items: Item[],
    memberships?: ResultOf<ItemMembershipRaw[]>,
    { withDeleted = false }: { withDeleted?: boolean } = {},
  ): Promise<PackedItem[]> {
    // no items, so nothing to fetch
    if (!items.length) {
      return [];
    }

    const visibilities = await this.itemVisibilityRepository.getForManyItems(db, items, {
      withDeleted,
    });

    const m =
      memberships ??
      (await this.itemMembershipRepository.getForManyItems(db, items, {
        withDeleted,
      }));

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
        ...item,
        permission,
        hidden: itemVisibilities.find((t) => t.type === ItemVisibilityType.Hidden),
        public: itemVisibilities.find((t) => t.type === ItemVisibilityType.Public),
        ...(thumbnails ? { thumbnails } : {}),
      } as unknown as PackedItem;
    });
  }
}
