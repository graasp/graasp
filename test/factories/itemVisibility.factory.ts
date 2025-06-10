import { v4 } from 'uuid';

import type { ItemVisibilityWithItem } from '../../src/drizzle/types';

export const ItemVisibilityFactory = (
  itemVisibility: Pick<ItemVisibilityWithItem, 'item' | 'type'>,
): ItemVisibilityWithItem => ({
  createdAt: new Date().toISOString(),
  creatorId: null,
  id: v4(),
  itemPath: itemVisibility.item.path,
  ...itemVisibility,
});
