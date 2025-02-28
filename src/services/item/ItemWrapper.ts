import { ItemVisibilityType, ResultOf, ThumbnailsBySize } from '@graasp/sdk';

import { Item } from '../../drizzle/types';
import { ItemMembership } from '../itemMembership/entities/ItemMembership';
import { ItemMembershipRepository } from '../itemMembership/repository';
import { ItemVisibility } from './plugins/itemVisibility/ItemVisibility';
import { ItemVisibilityRepository } from './plugins/itemVisibility/repository';
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
  hidden?: ItemVisibility;
  public?: ItemVisibility;
  thumbnails?: ThumbnailsBySize;
};

export class ItemWrapper {
  item: Item;
  actorPermission?: { permission: ItemMembership['permission'] } | null;
  visibilities?: ItemVisibility[] | null;
  private readonly thumbnails?: ThumbnailsBySize;

  constructor(
    item: Item,
    im?: { permission: ItemMembership['permission'] } | null,
    visibilities?: ItemVisibility[] | null,
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
      this.visibilities.sort((a, b) =>
        a.item.path.length > b.item.path.length ? 1 : -1,
      );
    }

    return {
      ...this.item,
      permission: this.actorPermission?.permission ?? null,
      hidden: this.visibilities?.find(
        (t) => t.type === ItemVisibilityType.Hidden,
      ),
      public: this.visibilities?.find(
        (t) => t.type === ItemVisibilityType.Public,
      ),
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
    items: Item[],
    memberships: ResultOf<ItemMembership | null>,
    visibilities?: ResultOf<ItemVisibility[] | null>,
    itemsThumbnails?: ItemsThumbnails,
  ): PackedItem[] {
    const data: PackedItem[] = [];

    for (const i of items) {
      const { permission = null } = memberships.data[i.id] ?? {};
      const thumbnails = itemsThumbnails?.[i.id];

      // sort visibilities to retrieve the most restrictive (highest) visibility first
      const itemVisibilities = visibilities?.data?.[i.id];
      if (itemVisibilities) {
        itemVisibilities.sort((a, b) =>
          a.item.path.length > b.item.path.length ? 1 : -1,
        );
      }

      data.push({
        ...i,
        permission,
        hidden: itemVisibilities?.find(
          (t) => t.type === ItemVisibilityType.Hidden,
        ),
        public: itemVisibilities?.find(
          (t) => t.type === ItemVisibilityType.Public,
        ),
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
    memberships: ResultOf<ItemMembership | null>,
    visibilities?: ResultOf<ItemVisibility[] | null>,
    itemsThumbnails?: ItemsThumbnails,
  ): ResultOf<PackedItem> {
    const data: ResultOf<PackedItem>['data'] = {};

    for (const i of Object.values(items.data)) {
      const { permission = null } = memberships.data[i.id] ?? {};
      const thumbnails = itemsThumbnails?.[i.id];

      // sort visibilities to retrieve the most restrictive (highest) visibility first
      const itemVisibilities = visibilities?.data?.[i.id];
      if (itemVisibilities) {
        itemVisibilities.sort((a, b) =>
          a.item.path.length > b.item.path.length ? 1 : -1,
        );
      }

      data[i.id] = {
        ...i,
        permission,
        hidden: itemVisibilities?.find(
          (t) => t.type === ItemVisibilityType.Hidden,
        ),
        public: itemVisibilities?.find(
          (t) => t.type === ItemVisibilityType.Public,
        ),
        ...(thumbnails ? { thumbnails } : {}),
      };
    }

    return { data, errors: [...items.errors, ...memberships.errors] };
  }

  async createPackedItems(
    actor: Actor,
    itemThumbnailService: ItemThumbnailService,
    items: Item[],
    memberships?: ResultOf<ItemMembership[]>,
    { withDeleted = false }: { withDeleted?: boolean } = {},
  ): Promise<PackedItem[]> {
    // no items, so nothing to fetch
    if (!items.length) {
      return [];
    }

    const visibilities = await this.itemVisibilityRepository.getForManyItems(
      items,
      {
        withDeleted,
      },
    );

    const m =
      memberships ??
      (await this.itemMembershipRepository.getForManyItems(items, {
        withDeleted,
      }));

    const itemsThumbnails =
      await this.itemThumbnailService.getUrlsByItems(items);

    return items.map((item) => {
      const permission = m.data[item.id][0]?.permission;
      const thumbnails = itemsThumbnails[item.id];

      // sort visibilities to retrieve the most restrictive (highest) visibility first
      const itemVisibilities = visibilities?.data?.[item.id] ?? [];
      if (itemVisibilities) {
        itemVisibilities.sort((a, b) =>
          a.item.path.length > b.item.path.length ? 1 : -1,
        );
      }

      return {
        ...item,
        permission,
        hidden: itemVisibilities.find(
          (t) => t.type === ItemVisibilityType.Hidden,
        ),
        public: itemVisibilities.find(
          (t) => t.type === ItemVisibilityType.Public,
        ),
        ...(thumbnails ? { thumbnails } : {}),
      } as unknown as PackedItem;
    });
  }
}
