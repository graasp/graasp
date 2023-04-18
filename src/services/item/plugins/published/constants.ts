import { Context } from '@graasp/sdk';

import { CLIENT_HOSTS, PROTOCOL } from '../../../../utils/config';
import { Item } from '../../entities/Item';

export const buildPublishedItemLink = (item: Item) => {
  const library = CLIENT_HOSTS.find(({ name }) => name === Context.LIBRARY);
  return `${PROTOCOL}://${library}/${item.id}`;
};
