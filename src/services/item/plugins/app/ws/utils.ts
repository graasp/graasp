import { Websocket } from '@graasp/sdk';

import { type ItemRaw } from '../../../item';

export const checkItemIsApp = (item: ItemRaw): void => {
  if (item.type !== 'app') {
    throw new Websocket.AccessDeniedError('item is not app');
  }
};
