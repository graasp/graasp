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
type ItemPacked = GraaspItem & {
  permission?: ItemMembership['permission'];
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
   * @returns ResultOf<ItemPacked>
   */
  static merge(
    items: ResultOf<Item>,
    memberships: ResultOf<ItemMembership | null>,
  ): ResultOf<ItemPacked> {
    const data: ResultOf<ItemPacked>['data'] = {};

    for (const i of Object.values(items.data)) {
      const { permission } = memberships.data[i.id] ?? {};
      data[i.id] = { ...i, permission };
    }

    return { data, errors: [...items.errors, ...memberships.errors] };
  }

  /**
   * build item unit with complementary info, such as permission
   * @returns item unit with permission
   */
  packed(): ItemPacked {
    return { ...this.item, permission: this.actorHighestItemMembership?.permission };
  }
}
