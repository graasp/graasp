import { ResultOf } from '@graasp/sdk';

import { ItemMembership } from '../itemMembership/entities/ItemMembership';
import { Item } from './entities/Item';

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

// TODO: export in sdk??

export type PackedItem = GraaspItem & {
  // permission can be undefined because the item is public
  permission: ItemMembership['permission'] | null;
};

export class ItemWrapper {
  item: Item;
  actorHighestItemMembership?: ItemMembership | null;

  constructor(item: Item, im?: ItemMembership | null) {
    this.item = item;
    this.actorHighestItemMembership = im;
  }

  /**
   * merge items and their permission in a result of structure
   * @param items result of many items
   * @param memberships result memberships for many items
   * @returns PackedItem[]
   */
  static merge(items: Item[], memberships: ResultOf<ItemMembership | null>): PackedItem[] {
    const data: PackedItem[] = [];

    for (const i of items) {
      const { permission = null } = memberships.data[i.id] ?? {};
      data.push({ ...i, permission });
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
  ): ResultOf<PackedItem> {
    const data: ResultOf<PackedItem>['data'] = {};

    for (const i of Object.values(items.data)) {
      const { permission = null } = memberships.data[i.id] ?? {};
      data[i.id] = { ...i, permission };
    }

    return { data, errors: [...items.errors, ...memberships.errors] };
  }

  /**
   * build item unit with complementary info, such as permission
   * @returns item unit with permission
   */
  packed(): PackedItem {
    return { ...this.item, permission: this.actorHighestItemMembership?.permission ?? null };
  }
}
