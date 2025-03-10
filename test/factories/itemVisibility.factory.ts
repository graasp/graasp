import { v4 } from 'uuid';

import { ItemVisibilityWithItem } from '../../src/drizzle/types';

export const ItemVisibilityFactory = (
  itemVisibility: Pick<ItemVisibilityWithItem, 'item' | 'type'>,
): ItemVisibilityWithItem => ({
  createdAt: new Date().toISOString(),
  creatorId: null,
  id: v4(),
  ...itemVisibility,
});
