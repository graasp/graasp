import { readPdfText } from 'pdf-text-reader';

import { ItemType, UUID, buildPathFromIds, isChildOf } from '@graasp/sdk';

import { FolderItem, Item, isItemType } from './entities/Item';

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
    if (isItemType(original, ItemType.FOLDER) && isItemType(copy, ItemType.FOLDER)) {
      // init extra if necessary
      if (!copy.extra.folder) {
        copy.extra.folder = { childrenOrder: [] };
      }

      const childrenOrder = original.extra.folder?.childrenOrder || [];

      // change previous ids to copied item ids
      const copyOrder = childrenOrder
        .map((oldId) => itemsMap.get(oldId)?.copy.id)
        .filter(Boolean) as UUID[];

      // get direct children
      const children = copyItemsArray.filter(({ id, path }) => {
        return path === `${copy.path}.${buildPathFromIds(id)}`;
      });

      // sort children to get wanter order -> get order by mapping to id
      children.sort(sortChildrenWith(copyOrder));
      const completeOrder = children.map(({ id }) => id);

      copy.extra.folder.childrenOrder = completeOrder;
    }

    return value;
  });
};

// cannot use sdk sort because of createdAt type
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

const getDirectChildren = (descendants: Item[], parentItem: Item): Item[] => {
  return descendants.filter((child) => isChildOf(child.path, parentItem.path));
};

// cannot use sdk sort because of createdAt type
export const sortChildrenForTreeWith = (descendants: Item[], parentItem: FolderItem): Item[] => {
  const order = parentItem.extra.folder.childrenOrder;
  const directChildren = getDirectChildren(descendants, parentItem);
  // order if exists
  if (order) {
    const compareFn = sortChildrenWith(order);
    directChildren.sort(compareFn);
  }

  const tree = directChildren.map((directChild) => {
    if (!isItemType(directChild, ItemType.FOLDER)) {
      return [directChild];
    }
    return [directChild, ...sortChildrenForTreeWith(descendants, directChild)];
  });
  return tree.flat();
};

export const readPdfContent = async (source: string | URL) => {
  try {
    const pages = await readPdfText({ url: source, useSystemFonts: true });
    //limit indexing to first pages
    const maxPage = Math.min(pages.length, 10);
    return pages
      .slice(0, maxPage)
      .flatMap((p) => p.lines)
      .join(' ')
      .replace(/\0/g, ' '); // Replace the null unicode character because Postgres can't parse it as JSON
  } catch {
    return '';
  }
};
