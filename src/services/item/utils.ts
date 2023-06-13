import { FolderItemExtra, ItemType, UUID } from '@graasp/sdk';

import { Item } from './entities/Item';

export const itemDepth = (item: Item): number => {
  return item.path.split('.').length;
};

export const parentPath = (item: Item): string | null => {
  const index = item.path.lastIndexOf('.');
  return index === -1 ? null : item.path.slice(0, index);
};

export const pathToId = (path: string): string => {
  const index = path.lastIndexOf('.');
  return underscoreToDash(index === -1 ? path : path.slice(index + 1));
};

export const dashToUnderscore = (value: string) => value.replace(/-/g, '_');
const underscoreToDash = (value: string) => value.replace(/_/g, '-');

// replace children order with new ids
export const _fixChildrenOrder = (itemsMap: Map<string, { copy: Item; original: Item }>) => {
  // get copied with original createdAt to later compare
  const copyItemsArray = Array.from(itemsMap.values()).map(({ copy, original }) => ({
    ...copy,
    createdAt: original.createdAt,
  }));
  itemsMap.forEach((value) => {
    const { copy, original } = value;
    // set order for all copied folder
    if (original.type === ItemType.FOLDER) {
      // init extra if necessary
      if (!copy.extra.folder) {
        copy.extra.folder = {};
      }

      const childrenOrder = (original.extra as FolderItemExtra)?.folder?.childrenOrder || [];

      // change previous ids to copied item ids
      const copyOrder = childrenOrder
        .map((oldId) => itemsMap.get(oldId)?.copy?.id)
        .filter(Boolean) as UUID[];

      // get direct children
      const children = copyItemsArray.filter(({ id, path }) => {
        return path === `${copy.path}.${dashToUnderscore(id)}`;
      });

      // sort children to get wanter order -> get order by mapping to id
      children.sort(sortChildrenWith(copyOrder));
      const completeOrder = children.map(({ id }) => id);

      (copy.extra as FolderItemExtra).folder.childrenOrder = completeOrder;
    }

    return value;
  });
};

export const sortChildrenWith = (idsOrder: string[]) => (stElem: Item, ndElem: Item) => {
  if (idsOrder.indexOf(stElem.id) >= 0 && idsOrder.indexOf(ndElem.id) >= 0) {
    return idsOrder.indexOf(stElem.id) - idsOrder.indexOf(ndElem.id);
  }
  if (idsOrder.indexOf(stElem.id) >= 0) {
    return -1;
  }

  if (idsOrder.indexOf(ndElem.id) >= 0) {
    return 1;
  }

  return stElem.createdAt.getTime() - ndElem.createdAt.getTime();
};
