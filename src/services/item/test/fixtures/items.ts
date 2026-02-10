import { ItemVisibilityType, ThumbnailSize, buildPathFromIds } from '@graasp/sdk';

import type { ItemVisibilityRaw } from '../../../../drizzle/types';
import type { MinimalMember } from '../../../../types';
import type { ItemRaw } from '../../item';
import type { PackedItem } from '../../packedItem.dto';

export const expectItem = (
  newItem: Partial<ItemRaw> | undefined | null,
  correctItem: Partial<Omit<ItemRaw, 'createdAt' | 'updatedAt'>> | undefined | null,
  creator?: MinimalMember,
  parent?: ItemRaw,
) => {
  if (!newItem || !newItem.id) {
    throw new Error('expectItem.newItem is not defined ' + JSON.stringify(newItem));
  }
  if (!correctItem) {
    throw new Error('expectItem.correctItem is not defined ' + JSON.stringify(correctItem));
  }
  expect(newItem.name).toEqual(correctItem.name);
  expect(newItem.description).toEqual(correctItem.description ?? null);
  expect(newItem.extra).toEqual(correctItem.extra);
  expect(newItem.type).toEqual(correctItem.type);
  if (correctItem.lang) {
    expect(newItem.lang).toEqual(correctItem.lang);
  }
  expect(newItem.path).toContain(buildPathFromIds(newItem.id));
  if (parent) {
    expect(newItem.path).toContain(buildPathFromIds(parent.path));
  }

  if (newItem.creatorId && creator) {
    expect(newItem.creatorId).toEqual(creator.id);
  }

  if (correctItem.settings) {
    for (const [k, s] of Object.entries(correctItem.settings)) {
      expect(newItem.settings![k]).toEqual(s);
    }
  }
};

export const expectPackedItem = (
  newItem: Partial<PackedItem> | undefined | null,
  correctItem:
    | (Partial<Omit<PackedItem, 'createdAt' | 'updatedAt' | 'creator'>> &
        Pick<PackedItem, 'permission'>)
    | undefined
    | null,
  creator?: MinimalMember,
  parent?: ItemRaw,
  visibilities?: Pick<ItemVisibilityRaw, 'id' | 'type' | 'itemPath'>[],
) => {
  expectItem(newItem, correctItem, creator, parent);

  expect(newItem!.permission).toEqual(correctItem?.permission);

  const pVisibility = visibilities?.find((t) => t.type === ItemVisibilityType.Public);
  if (pVisibility) {
    expect(newItem!.public!.type).toEqual(pVisibility.type);
    expect(newItem!.public!.id).toEqual(pVisibility.id);
    expect(newItem!.public!.itemPath).toEqual(pVisibility.itemPath);
  }
  const hVisibility = visibilities?.find((t) => t.type === ItemVisibilityType.Hidden);
  if (hVisibility) {
    expect(newItem!.hidden!.type).toEqual(hVisibility.type);
    expect(newItem!.hidden!.id).toEqual(hVisibility.id);
    expect(newItem!.hidden!.itemPath).toEqual(hVisibility.itemPath);
  }
};

export const expectManyItems = (
  items: ItemRaw[],
  correctItems: Partial<
    Pick<ItemRaw, 'id' | 'name' | 'description' | 'type' | 'extra' | 'settings'>
  >[],
  creator?: MinimalMember,
  parent?: ItemRaw,
) => {
  expect(items).toHaveLength(correctItems.length);

  items.forEach(({ id }) => {
    const item = items.find(({ id: thisId }) => thisId === id);
    const correctItem = correctItems.find(({ id: thisId }) => thisId === id);
    expectItem(item, correctItem, creator, parent);
  });
};

export const expectManyPackedItems = (
  items: PackedItem[],
  correctItems: (Partial<
    Pick<PackedItem, 'id' | 'name' | 'description' | 'type' | 'extra' | 'settings'>
  > &
    Pick<PackedItem, 'permission'>)[],
  creator?: MinimalMember,
  parent?: ItemRaw,
  visibilities?: ItemVisibilityRaw[],
) => {
  expect(items).toHaveLength(correctItems.length);

  items.forEach(({ id, path }) => {
    const item = items.find(({ id: thisId }) => thisId === id);
    const correctItem = correctItems.find(({ id: thisId }) => thisId === id);
    const tVisibilities = visibilities?.filter((t) => t.itemPath === path);
    expectPackedItem(item, correctItem, creator, parent, tVisibilities);
  });
};

export const expectThumbnails = (
  item: PackedItem,
  thumbnailUrl: string,
  shouldContainThumbnails: boolean,
) => {
  if (shouldContainThumbnails) {
    expect(item.thumbnails).toBeDefined();
    expect(item.thumbnails![ThumbnailSize.Small]).toBe(thumbnailUrl);
    expect(item.thumbnails![ThumbnailSize.Medium]).toBe(thumbnailUrl);
  } else {
    expect(item.thumbnails).toBeUndefined();
  }
};
