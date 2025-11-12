import { v4 } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThumbnailSize } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../test/app.vitest';
import { ItemFactory } from '../../../../../test/factories/item.factory';
import { db } from '../../../../drizzle/db';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service';
import { ItemService } from '../../item.service';
import { ItemThumbnailService } from './itemThumbnail.service';
import { constructMockedUrl, expectValidUrls } from './test/fixtures/utils';

const mockedItemsId = [
  ItemFactory({ settings: { hasThumbnail: true } }),
  ItemFactory({ settings: { hasThumbnail: true } }),
  ItemFactory({ settings: { hasThumbnail: true } }),
];

const dummyItemService = {
  get: vi.fn(),
} as unknown as ItemService;
const stubThumbnailService = {
  getUrl: constructMockedUrl,
} as unknown as ThumbnailService;
const stubAuthorizedItemService = {
  getItemById: vi.fn(),
} as unknown as AuthorizedItemService;

export const itemThumbnailService = new ItemThumbnailService(
  dummyItemService,
  stubThumbnailService,
  stubAuthorizedItemService,
  MOCK_LOGGER,
);

describe('ItemThumbnailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('getUrl', () => {
    it('return url for item and size', async () => {
      const MOCK_ITEM = ItemFactory({ settings: { hasThumbnail: true } });
      vi.spyOn(stubAuthorizedItemService, 'getItemById').mockResolvedValue(MOCK_ITEM);

      const size = ThumbnailSize.Large;
      const result = await itemThumbnailService.getUrl(db, undefined, {
        size,
        itemId: mockedItemsId[0].id,
      });
      expect(result).toEqual(constructMockedUrl({ size, id: mockedItemsId[0].id }));
    });
    it('return null for item without thumbnail', async () => {
      const MOCK_ITEM = ItemFactory({ settings: { hasThumbnail: false } });
      vi.spyOn(stubAuthorizedItemService, 'getItemById').mockResolvedValue(MOCK_ITEM);

      const result = await itemThumbnailService.getUrl(db, undefined, {
        size: ThumbnailSize.Large,
        itemId: mockedItemsId[0].id,
      });
      expect(result).toBeNull();
    });
    it('throw if cannot get item', async () => {
      vi.spyOn(stubAuthorizedItemService, 'getItemById').mockRejectedValue(new Error());
      await expect(() =>
        itemThumbnailService.getUrl(db, undefined, {
          size: ThumbnailSize.Large,
          itemId: v4(),
        }),
      ).rejects.toThrow();
    });
  });

  describe('getUrlsByItems', () => {
    it('Retrieve the medium and small URLs if no size is specified', async () => {
      const expectedSizes = [ThumbnailSize.Medium, ThumbnailSize.Small];
      const results = await itemThumbnailService.getUrlsByItems(mockedItemsId);
      expectValidUrls(mockedItemsId, results, expectedSizes);
    });

    it('Retrieve the specified sizes', async () => {
      const expectedSizes = [ThumbnailSize.Medium, ThumbnailSize.Small];

      const results = await itemThumbnailService.getUrlsByItems(mockedItemsId);
      expectValidUrls(mockedItemsId, results, expectedSizes);
    });

    it('Empty item ids array should return empty object', async () => {
      expect(await itemThumbnailService.getUrlsByItems([])).toEqual({});
    });

    it('Handles failures gracefully', async () => {
      // define a flacky thumbnail service that fails for the first itemId
      const stubThumbnailService = {
        getUrl: vi.fn().mockImplementation(async ({ id }) => {
          // fail for the first one
          if (id === mockedItemsId[0].id) {
            throw new Error();
          }
          return 'abcd';
        }),
      } as unknown as ThumbnailService;

      const flackyItemThumbnailService = new ItemThumbnailService(
        dummyItemService,
        stubThumbnailService,
        stubAuthorizedItemService,
        MOCK_LOGGER,
      );

      // fetch the thumbnails
      const result = await flackyItemThumbnailService.getUrlsByItems(mockedItemsId);
      // expected result to not have the first one
      const expectedResult = mockedItemsId
        .slice(1)
        .map((item) => ({
          [item.id]: { small: 'abcd', medium: 'abcd' },
        }))
        .reduce((acc, curr) => ({ ...acc, ...curr }), {});

      expect(result).toEqual(expectedResult);
    });
  });
});
