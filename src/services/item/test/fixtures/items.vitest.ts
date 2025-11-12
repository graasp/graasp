import { expect } from 'vitest';

import { buildPathFromIds } from '@graasp/sdk';

import { ItemRaw } from '../../../../drizzle/types';
import { MinimalMember } from '../../../../types';

export const expectItem = (
  newItem: Partial<ItemRaw> | undefined | null,
  correctItem: Partial<Omit<ItemRaw, 'createdAt' | 'updatedAt' | 'creator'>> | undefined | null,
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
