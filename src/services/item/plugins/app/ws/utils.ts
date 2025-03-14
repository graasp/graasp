import { ItemType, Websocket } from '@graasp/sdk';

import { Item } from '../../../../../drizzle/types.js';

export const checkItemIsApp = (item: Item): void => {
  if (item.type !== ItemType.APP) {
    throw new Websocket.AccessDeniedError('item is not app');
  }
};
