import { Context } from '@graasp/sdk';

import { CLIENT_HOSTS } from '../../../../utils/config';
import { Item } from '../../entities/Item';

export const buildPublishedItemLink = (item: Item) => {
  const library = CLIENT_HOSTS.find(({ name }) => name === Context.Library);
  const target = new URL(item.id, library?.url);
  return target.toString();
};
