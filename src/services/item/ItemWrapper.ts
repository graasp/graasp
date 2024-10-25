import { ItemTagType, ResultOf, ThumbnailsBySize } from '@graasp/sdk';

import { Repositories } from '../../utils/repositories';
import { ItemMembership } from '../itemMembership/entities/ItemMembership';
import { Actor } from '../member/entities/member';
import { Item } from './entities/Item';
import { ItemTag } from './plugins/itemTag/ItemTag';
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
  hidden: ItemTag | undefined;
  public: ItemTag | undefined;
  thumbnails?: ThumbnailsBySize;
};

export class ItemWrapper {
  item: Item;
  actorPermission?: { permission: ItemMembership['permission'] } | null;
  tags?: ItemTag[] | null;
  private readonly thumbnails?: ThumbnailsBySize;

  constructor(
    item: Item,
    im?: { permission: ItemMembership['permission'] } | null,
    tags?: ItemTag[] | null,
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
    tags?: ResultOf<ItemTag[] | null>,
    itemsThumbnails?: ItemsThumbnails,
  ): PackedItem[] {
    const data: PackedItem[] = [];

    for (const i of items) {
      const { permission = null } = memberships.data[i.id] ?? {};
      const thumbnails = itemsThumbnails?.[i.id];

      // sort tags to retrieve most relevant (highest) tag first
      const thisTags = tags?.data?.[i.id];
      if (thisTags) {
        thisTags.sort((a, b) => (a.item.path.length > b.item.path.length ? 1 : -1));
      }

      data.push({
        ...i,
        permission,
        hidden: thisTags?.find((t) => t.type === ItemTagType.Hidden),
        public: thisTags?.find((t) => t.type === ItemTagType.Public),
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
    tags?: ResultOf<ItemTag[] | null>,
    itemsThumbnails?: ItemsThumbnails,
  ): ResultOf<PackedItem> {
    const data: ResultOf<PackedItem>['data'] = {};

    for (const i of Object.values(items.data)) {
      const { permission = null } = memberships.data[i.id] ?? {};
      const thumbnails = itemsThumbnails?.[i.id];

      // sort tags to retrieve most relevant (highest) tag first
      const thisTags = tags?.data?.[i.id];
      if (thisTags) {
        thisTags.sort((a, b) => (a.item.path.length > b.item.path.length ? 1 : -1));
      }

      data[i.id] = {
        ...i,
        permission,
        hidden: thisTags?.find((t) => t.type === ItemTagType.Hidden),
        public: thisTags?.find((t) => t.type === ItemTagType.Public),
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

    const tags = await repositories.itemTagRepository.getForManyItems(items, { withDeleted });

    const m =
      memberships ??
      (await repositories.itemMembershipRepository.getForManyItems(items, { withDeleted }));

    const itemsThumbnails = await itemThumbnailService.getUrlsByItems(items);

    return items.map((item) => {
      const permission = m.data[item.id][0]?.permission;
      const thumbnails = itemsThumbnails[item.id];

      // sort tags to retrieve most relevant (highest) tag first
      const thisTags = tags?.data?.[item.id] ?? [];
      if (thisTags) {
        thisTags.sort((a, b) => (a.item.path.length > b.item.path.length ? 1 : -1));
      }

      return {
        ...item,
        permission,
        hidden: thisTags.find((t) => t.type === ItemTagType.Hidden),
        public: thisTags.find((t) => t.type === ItemTagType.Public),
        ...(thumbnails ? { thumbnails } : {}),
      } as unknown as PackedItem;
    });
  }

  /**
   * build item unit with complementary info, such as permission
   * @returns item unit with permission
   */
  packed(): PackedItem {
    // sort tags to retrieve most relevant (highest) tag first
    if (this.tags) {
      this.tags.sort((a, b) => (a.item.path.length > b.item.path.length ? 1 : -1));
    }

    return {
      ...this.item,
      permission: this.actorPermission?.permission ?? null,
      hidden: this.tags?.find((t) => t.type === ItemTagType.Hidden),
      public: this.tags?.find((t) => t.type === ItemTagType.Public),
      thumbnails: this.thumbnails,
    };
  }
}
