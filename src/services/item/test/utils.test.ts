import { ItemType } from '@graasp/sdk';

import { FolderItem, Item } from '../entities/Item';
import { sortChildrenForTreeWith } from '../utils';

const parentItem = {
  id: 'parent',
  path: `parent`,
  createdAt: new Date(),
  type: ItemType.FOLDER,
  order: 1,
} as unknown as FolderItem;
const a = {
  id: 'a',
  path: `parent.a`,
  createdAt: new Date(),
  order: 1,
  type: ItemType.FOLDER,
} as unknown as Item;
const b = {
  id: 'b',
  path: `parent.b`,
  type: ItemType.FOLDER,
  createdAt: new Date(Date.now() + 1),
  order: 2,
} as unknown as Item;
const c = {
  id: 'c',
  path: `parent.c`,
  type: ItemType.FOLDER,
  createdAt: new Date(Date.now() + 2),
  order: 3,
} as unknown as Item;
const d = {
  id: 'd',
  path: `parent.c.d`,
  type: ItemType.FOLDER,
  createdAt: new Date(Date.now() + 3),
  order: 1,
} as unknown as Item;
const e = {
  id: 'e',
  type: ItemType.FOLDER,
  path: `parent.a.e`,
  createdAt: new Date(Date.now() + 4),
  order: 1,
} as unknown as Item;
const f = {
  id: 'f',
  type: ItemType.FOLDER,
  path: `parent.a.f`,
  createdAt: new Date(Date.now() + 5),
  order: 3,
} as unknown as Item;

const items: Item[] = [a, b, c, d, e, f];

describe('sortChildrenForTreeWith', () => {
  it('Order correctly with all items in order', () => {
    const result = [a, e, f, b, c, d];
    const sorted = sortChildrenForTreeWith(items, parentItem);
    expect(sorted).toEqual(result);
  });
});
