import { Context } from '@graasp/sdk';

import { CLIENT_HOSTS } from '../../../../utils/config';
import { Item } from '../../entities/Item';

export const buildPublishedItemLink = (item: Item): string | null => {
  const library = CLIENT_HOSTS.find(({ name }) => name === Context.Library)?.url;
  if (!library) {
    return null;
  }

  const target = new URL(`/${item.id}`, library.origin);
  return target.toString();
};
