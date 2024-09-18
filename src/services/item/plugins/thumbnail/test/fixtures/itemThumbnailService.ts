import { ThumbnailSizeType } from '@graasp/sdk';

import { BaseLogger } from '../../../../../../logger';
import { ThumbnailService } from '../../../../../thumbnail/service';
import { ItemService } from '../../../../service';
import { ItemThumbnailService } from '../../service';
import { ItemsThumbnails } from '../../types';

export const constructMockedItem = (id: string) => ({ id, settings: { hasThumbnail: true } });
export const constructMockedUrls = ({ size, id }: { size: string; id: string }) =>
  `mocked-url/${id}?${size}`;

const dummyItemService = {} as ItemService;
const dummyLogger = {} as BaseLogger;
const stubThumbnailService = {
  getUrl: constructMockedUrls,
} as unknown as ThumbnailService;

export const StubItemThumbnailService = () =>
  new ItemThumbnailService(dummyItemService, stubThumbnailService, dummyLogger);

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
        expect(urls?.[s]).toBe(constructMockedUrls({ size: String(s), id })),
      );
    });
};
