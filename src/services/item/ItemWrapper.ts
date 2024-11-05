import { ItemVisibilityType, ResultOf, ThumbnailsBySize } from '@graasp/sdk';

import { Repositories } from '../../utils/repositories';
import { ItemMembership } from '../itemMembership/entities/ItemMembership';
import { Actor } from '../member/entities/member';
import { Item } from './entities/Item';
import { ItemVisibility } from './plugins/itemVisibility/ItemVisibility';
import { ItemThumbnailService } from './plugins/thumbnail/service';
import { ItemsThumbnails } from './plugins/thumbnail/types';

type GraaspItem = Pick<
  Item,
  | 'id'
  | 'name'
  | 'type'
  | 'path'
  | 'geolocation'
  | 'description'
  | 'extra'
  | 'createdAt'
  | 'creator'
  | 'updatedAt'
  | 'settings'
  | 'lang'
>;

export type PackedItem = GraaspItem & {
  // permission can be undefined because the item is public
  permission: ItemMembership['permission'] | null;
  hidden: ItemVisibility | undefined;
  public: ItemVisibility | undefined;
  thumbnails?: ThumbnailsBySize;
};

export class ItemWrapper {
  item: Item;
  actorPermission?: { permission: ItemMembership['permission'] } | null;
  tags?: ItemVisibility[] | null;
  private readonly thumbnails?: ThumbnailsBySize;

  constructor(
    item: Item,
    im?: { permission: ItemMembership['permission'] } | null,
    tags?: ItemVisibility[] | null,
    thumbnails?: ThumbnailsBySize,
  ) {
    this.item = item;
    this.actorPermission = im;
    this.tags = tags;
    this.thumbnails = thumbnails;
  }

  /**
   * merge items and their permission in a result of structure
   * @param items result of many items
   * @param memberships result memberships for many items
   * @returns PackedItem[]
   */
  static merge(
    items: Item[],
    memberships: ResultOf<ItemMembership | null>,
    tags?: ResultOf<ItemVisibility[] | null>,
    itemsThumbnails?: ItemsThumbnails,
  ): PackedItem[] {
    const data: PackedItem[] = [];

    for (const i of items) {
      const { permission = null } = memberships.data[i.id] ?? {};
      const thumbnails = itemsThumbnails?.[i.id];

      // sort tags to retrieve most relevant (highest) visibility first
      const itemVisibilities = tags?.data?.[i.id];
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
  static mergeResult(
    items: ResultOf<Item>,
    memberships: ResultOf<ItemMembership | null>,
    tags?: ResultOf<ItemVisibility[] | null>,
    itemsThumbnails?: ItemsThumbnails,
  ): ResultOf<PackedItem> {
    const data: ResultOf<PackedItem>['data'] = {};

    for (const i of Object.values(items.data)) {
      const { permission = null } = memberships.data[i.id] ?? {};
      const thumbnails = itemsThumbnails?.[i.id];

      // sort tags to retrieve most relevant (highest) visibility first
      const itemVisibilities = tags?.data?.[i.id];
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

  static async createPackedItems(
    actor: Actor,
    repositories: Repositories,
    itemThumbnailService: ItemThumbnailService,
    items: Item[],
    memberships?: ResultOf<ItemMembership[]>,
    { withDeleted = false }: { withDeleted?: boolean } = {},
  ): Promise<PackedItem[]> {
    // no items, so nothing to fetch
    if (!items.length) {
      return [];
    }

    const tags = await repositories.itemVisibilityRepository.getForManyItems(items, {
      withDeleted,
    });

    const m =
      memberships ??
      (await repositories.itemMembershipRepository.getForManyItems(items, { withDeleted }));

    const itemsThumbnails = await itemThumbnailService.getUrlsByItems(items);

    return items.map((item) => {
      const permission = m.data[item.id][0]?.permission;
      const thumbnails = itemsThumbnails[item.id];

      // sort tags to retrieve most relevant (highest) visibility first
      const itemVisibilities = tags?.data?.[item.id] ?? [];
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

  /**
   * build item unit with complementary info, such as permission
   * @returns item unit with permission
   */
  packed(): PackedItem {
    // sort tags to retrieve most relevant (highest) visibility first
    if (this.tags) {
      this.tags.sort((a, b) => (a.item.path.length > b.item.path.length ? 1 : -1));
    }

    return {
      ...this.item,
      permission: this.actorPermission?.permission ?? null,
      hidden: this.tags?.find((t) => t.type === ItemVisibilityType.Hidden),
      public: this.tags?.find((t) => t.type === ItemVisibilityType.Public),
      thumbnails: this.thumbnails,
    };
  }
}
