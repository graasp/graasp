import { ItemTagType, ResultOf } from '@graasp/sdk';

import { Repositories } from '../../utils/repositories';
import { ItemMembership } from '../itemMembership/entities/ItemMembership';
import { Actor } from '../member/entities/member';
import { Item } from './entities/Item';
import { ItemTag } from './plugins/itemTag/ItemTag';

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
};

export class ItemWrapper {
  item: Item;
  actorPermission?: { permission: ItemMembership['permission'] } | null;
  tags?: ItemTag[] | null;

  constructor(
    item: Item,
    im?: { permission: ItemMembership['permission'] } | null,
    tags?: ItemTag[] | null,
  ) {
    this.item = item;
    this.actorPermission = im;
    this.tags = tags;
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
  ): PackedItem[] {
    const data: PackedItem[] = [];

    for (const i of items) {
      const { permission = null } = memberships.data[i.id] ?? {};
      data.push({
        ...i,
        permission,
        hidden: tags?.data?.[i.id]?.find((t) => t.type === ItemTagType.Hidden),
        public: tags?.data?.[i.id]?.find((t) => t.type === ItemTagType.Public),
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
  ): ResultOf<PackedItem> {
    const data: ResultOf<PackedItem>['data'] = {};

    for (const i of Object.values(items.data)) {
      const { permission = null } = memberships.data[i.id] ?? {};
      data[i.id] = {
        ...i,
        permission,
        hidden: tags?.data?.[i.id]?.find((t) => t.type === ItemTagType.Hidden),
        public: tags?.data?.[i.id]?.find((t) => t.type === ItemTagType.Public),
      };
    }

    return { data, errors: [...items.errors, ...memberships.errors] };
  }

  static async createPackedItems(
    actor: Actor,
    repositories: Repositories,
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

    // TODO
    return items.map((item) => {
      const permission = m.data[item.id][0]?.permission;
      return {
        ...item,
        permission,
        hidden: (tags?.data?.[item.id] ?? [])?.find((t) => t.type === ItemTagType.Hidden),
        public: (tags?.data?.[item.id] ?? [])?.find((t) => t.type === ItemTagType.Public),
      } as unknown as PackedItem;
    });
  }

  /**
   * build item unit with complementary info, such as permission
   * @returns item unit with permission
   */
  packed(): PackedItem {
    return {
      ...this.item,
      permission: this.actorPermission?.permission ?? null,
      hidden: this.tags?.find((t) => t.type === ItemTagType.Hidden),
      public: this.tags?.find((t) => t.type === ItemTagType.Public),
    };
  }
}
