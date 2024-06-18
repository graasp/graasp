import { LIBRARY_HOST } from '../../../../utils/config.js';
import { Item } from '../../entities/Item.js';

export const buildPublishedItemLink = (item: Item): string => {
  const target = new URL(`/collections/${item.id}`, LIBRARY_HOST.url);
  return target.toString();
};
