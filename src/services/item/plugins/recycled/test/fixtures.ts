import { buildPathFromIds } from '@graasp/sdk';

import { Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { RecycledItem } from '../RecycledItem';

export const expectRecycledItem = (newRecycledItem: RecycledItem, item: Item, creator?: Member) => {
  if (item) {
    expect(newRecycledItem.item.path).toEqual(item.path);
  }
  if (newRecycledItem.creator && creator) {
    expect(newRecycledItem.creator.id).toEqual(creator.id);
  }
};

export const expectManyRecycledItems = (
  newRecycledItems: RecycledItem[],
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
