import { LIBRARY_HOST } from '../../../../utils/config';
import { Item } from '../../entities/Item';

export const buildPublishedItemLink = (item: Item): string => {
  const target = new URL(`/collections/${item.id}`, LIBRARY_HOST.url);
  return target.toString();
};
