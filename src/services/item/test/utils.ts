import { MAX_TREE_LEVELS } from '@graasp/sdk';

import { Item } from '../../../drizzle/types.js';
import { MaybeUser } from '../../../types.js';
import { ItemTestUtils } from './fixtures/items.js';

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
