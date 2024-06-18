import { v4 } from 'uuid';

import { FolderItemFactory } from '@graasp/sdk';

import { FolderItem } from './entities/Item.js';
import { sortChildrenForTreeWith } from './utils.js';

const buildFolderItem = (
  args: {
    parentItem?: FolderItem;
    extra?: { folder: { childrenOrder: string[] } };
  } = {},
) => {
  const item = FolderItemFactory(args) as unknown as FolderItem;
  // change date time for it to work with the backend data
  item.createdAt = new Date(item.createdAt);
  return item;
};

describe('sortChildrenForTreeWith', () => {
  it('return empty for empty descendants', () => {
    const res = sortChildrenForTreeWith([], buildFolderItem());
    expect(res).toHaveLength(0);
  });

  it('return correct result for one-level descendants', () => {
    const parentItem = buildFolderItem();
    const first = buildFolderItem({ parentItem });
    const second = buildFolderItem({ parentItem });
    const third = buildFolderItem({ parentItem });
    // non listed child
    const fourth = buildFolderItem({ parentItem });
    parentItem.extra.folder.childrenOrder = [first.id, second.id, third.id];
    const descendants = [second, third, fourth, first];

    const res = sortChildrenForTreeWith(descendants, parentItem);

    expect(res).toHaveLength(descendants.length);
    expect(res[0]).toEqual(first);
    expect(res[1]).toEqual(second);
    expect(res[2]).toEqual(third);
    expect(res[3]).toEqual(fourth);
  });

  it('return correct result for two-level descendants', () => {
    // 1st level
    const parentItem = buildFolderItem();
    const first = buildFolderItem({ parentItem });
    const second = buildFolderItem({ parentItem });
    const third = buildFolderItem({ parentItem });
    parentItem.extra.folder.childrenOrder = [first.id, second.id, third.id];
    const parentDescendants = [second, third, first];

    // 2nd level for first element
    const firstFirst = buildFolderItem({ parentItem: first });
    const firstSecond = buildFolderItem({ parentItem: first });
    const firstThird = buildFolderItem({ parentItem: first });
    first.extra.folder.childrenOrder = [firstFirst.id, firstSecond.id, firstThird.id];
    const firstDescendants = [firstThird, firstFirst, firstSecond];

    // 2nd level for second element - missing ids
    const secondChild = buildFolderItem({ parentItem: second });
    second.extra.folder.childrenOrder = [v4(), v4(), v4()];

    // 2nd level for third element
    const thirdFirst = buildFolderItem({ parentItem: third });
    const thirdSecond = buildFolderItem({ parentItem: third });
    const thirdThird = buildFolderItem({ parentItem: third });
    third.extra.folder.childrenOrder = [thirdFirst.id, thirdSecond.id, thirdThird.id];
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
