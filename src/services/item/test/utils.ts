import { MAX_TREE_LEVELS } from '@graasp/sdk';

import { Item } from '../../../drizzle/types';
import { MaybeUser } from '../../../types';
import { ItemTestUtils } from './fixtures/items';

const testUtils = new ItemTestUtils();

export const saveUntilMaxDescendants = async (parent: Item, actor: MaybeUser) => {
  // save maximum depth
  // TODO: DYNAMIC
  let currentParent = parent;
  for (let i = 0; i < MAX_TREE_LEVELS - 1; i++) {
    const newCurrentParent = await testUtils.saveItem({
      actor,
      parentItem: currentParent,
    });
    currentParent = newCurrentParent;
  }
  // return last child
  return currentParent;
};
