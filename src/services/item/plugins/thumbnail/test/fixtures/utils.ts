import { expect } from 'vitest';

import type { ThumbnailSizeType } from '@graasp/sdk';

import type { ItemsThumbnails } from '../../types';

export const constructMockedUrl = ({ size, id }: { size: string; id: string }) =>
  `mocked-url/${id}?${size}`;

export const expectValidUrls = (
  items: { id: string }[],
  results: ItemsThumbnails,
  expectedSizes: ThumbnailSizeType[],
) => {
  items
    .map((i) => i.id)
    .forEach((id) => {
      const urls = results[id];

      expect(urls).toBeDefined();
      expectedSizes.forEach((s) =>
        expect(urls?.[s]).toBe(constructMockedUrl({ size: String(s), id })),
      );
    });
};
