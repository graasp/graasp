import { PackedItem } from '@graasp/sdk';

import { Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { PackedRecycledItemData, RecycledItemData } from '../RecycledItemData';

export const expectRecycledItem = (
  newRecycledItem: RecycledItemData,
  item?: Item,
  creator?: Member,
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
  creator?: Member,
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
  creator?: Member,
) => {
  newRecycledItems.forEach((rI) => {
    expectRecycledItem(
      rI,
      items.find(({ path }) => rI.item?.path === path),
      creator,
    );
  });
};

export const expectManyPackedRecycledItems = (
  newRecycledItems: PackedRecycledItemData[],
  items: PackedItem[],
  creator?: Member,
) => {
  newRecycledItems.forEach((rI) => {
    expectPackedRecycledItem(
      rI,
      items.find(({ path }) => rI.item?.path === path),
      creator,
    );
  });
};
