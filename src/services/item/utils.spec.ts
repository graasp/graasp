import { describe, expect, it } from 'vitest';

import { ItemFactory } from '../../../test/factories/item.factory';
import type { FolderItem } from './discrimination';
import { sortChildrenForTreeWith } from './utils';

const buildFolderItem = (args: { parentItem?: FolderItem; order: number }) => {
  const item = ItemFactory({ order: args.order, parentPath: args.parentItem?.path });
  return item as FolderItem;
};

describe('sortChildrenForTreeWith', () => {
  it('return empty for empty descendants', () => {
    const res = sortChildrenForTreeWith([], buildFolderItem({ order: 1 }));
    expect(res).toHaveLength(0);
  });

  it('return correct result for one-level descendants', () => {
    const parentItem = buildFolderItem({ order: 12 });
    const first = buildFolderItem({ parentItem, order: 1 });
    const second = buildFolderItem({ parentItem, order: 2 });
    const third = buildFolderItem({ parentItem, order: 3 });
    const descendants = [second, third, first];

    const res = sortChildrenForTreeWith(descendants, parentItem);

    expect(res).toHaveLength(descendants.length);
    expect(res[0]).toEqual(first);
    expect(res[1]).toEqual(second);
    expect(res[2]).toEqual(third);
  });

  it('return correct result for two-level descendants', () => {
    // 1st level
    const parentItem = buildFolderItem({ order: 3 });
    const first = buildFolderItem({ parentItem, order: 1 });
    const second = buildFolderItem({ parentItem, order: 2 });
    const third = buildFolderItem({ parentItem, order: 3 });
    const parentDescendants = [second, third, first];

    // 2nd level for first element
    const firstFirst = buildFolderItem({ parentItem: first, order: 1 });
    const firstSecond = buildFolderItem({ parentItem: first, order: 2 });
    const firstThird = buildFolderItem({ parentItem: first, order: 3 });
    const firstDescendants = [firstThird, firstFirst, firstSecond];

    // 2nd level for second element
    const secondChild = buildFolderItem({ parentItem: second, order: 3 });

    // 2nd level for third element
    const thirdFirst = buildFolderItem({ parentItem: third, order: 1 });
    const thirdSecond = buildFolderItem({ parentItem: third, order: 2 });
    const thirdThird = buildFolderItem({ parentItem: third, order: 3 });
    const thirdDescendants = [thirdThird, thirdFirst, thirdSecond];

    // unordred descendants
    const descendants = [
      ...firstDescendants,
      secondChild,
      ...parentDescendants,
      ...thirdDescendants,
    ];

    const res = sortChildrenForTreeWith(descendants, parentItem);

    expect(res).toHaveLength(descendants.length);
    expect(res[0]).toEqual(first);
    expect(res[1]).toEqual(firstFirst);
    expect(res[2]).toEqual(firstSecond);
    expect(res[3]).toEqual(firstThird);
    expect(res[4]).toEqual(second);
    expect(res[5]).toEqual(secondChild);
    expect(res[6]).toEqual(third);
    expect(res[7]).toEqual(thirdFirst);
    expect(res[8]).toEqual(thirdSecond);
    expect(res[9]).toEqual(thirdThird);
  });
});
