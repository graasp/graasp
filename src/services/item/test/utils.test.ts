import { Item } from '../entities/Item';
import { sortChildrenWith } from '../utils';

const a = {
  id: 'a',
  createdAt: new Date(),
} as unknown as Item;
const b = {
  id: 'b',
  createdAt: new Date(Date.now() + 1),
} as unknown as Item;
const c = {
  id: 'c',
  createdAt: new Date(Date.now() + 2),
} as unknown as Item;
const d = {
  id: 'd',
  createdAt: new Date(Date.now() + 3),
} as unknown as Item;
const e = {
  id: 'e',
  createdAt: new Date(Date.now() + 4),
} as unknown as Item;
const f = {
  id: 'f',
  createdAt: new Date(Date.now() + 5),
} as unknown as Item;

const items = [a, b, c, d, e, f];

describe('sortChildrenWith', () => {
  it('Order correctly with all items in order list', () => {
    const result = [a, e, f, b, c, d];
    const order = result.map(({ id }) => id);
    const copy = [...items];
    copy.sort(sortChildrenWith(order));

    expect(copy).toEqual(result);
  });
  it('Order correctly with some items missing in order list', () => {
    const result = [e, b, f, d];
    const order = result.map(({ id }) => id);
    const copy = [...items];
    copy.sort(sortChildrenWith(order));

    expect(copy).toEqual([...result, a, c]);
  });
  it('Order correctly with empty order list', () => {
    const result = [...items];
    items.sort(sortChildrenWith([]));

    expect(items).toEqual(result);
  });
  it('Order correctly with non existing items in order list', () => {
    const result = [e, b, f, d];
    const order = result.map(({ id }) => id);
    const orderWithRandomIds = ['x', ...order, 'y'];
    const copy = [...items];
    copy.sort(sortChildrenWith(orderWithRandomIds));

    expect(copy).toEqual([...result, a, c]);
  });
});
