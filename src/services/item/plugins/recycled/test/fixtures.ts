import { PackedItem } from '@graasp/sdk';

import { Item } from '../../../../../drizzle/types';
import { MinimalMember } from '../../../../../types';
import { PackedRecycledItemData, RecycledItemData } from '../RecycledItemData';

export const expectRecycledItem = (
  newRecycledItem: RecycledItemData,
  item?: Item,
  creator?: MinimalMember,
) => {
  if (!item) {
    throw 'expectRecycledItem.item is not defined';
  }
  expect(newRecycledItem.item.path).toEqual(item.path);
  if (newRecycledItem.creator && creator) {
    expect(newRecycledItem.creator.id).toEqual(creator.id);
  }
};
export const expectPackedRecycledItem = (
  newRecycledItem: PackedRecycledItemData,
  item?: PackedItem,
  creator?: MinimalMember,
) => {
  if (!item) {
    throw 'expectRecycledItem.item is not defined';
  }
  expect(newRecycledItem.item.permission).toEqual(item.permission);
  expectRecycledItem(newRecycledItem, item as unknown as Item, creator);
};

export const expectManyRecycledItems = (
  newRecycledItems: RecycledItemData[],
  items: Item[],
  creator?: MinimalMember,
) => {
  newRecycledItems.forEach((rI) => {
    expectRecycledItem(
      rI,
      items.find(({ path }) => rI.item?.path === path),
      creator,
    );
  });
};
