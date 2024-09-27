import { ThumbnailSize } from '@graasp/sdk';

import {
  StubItemThumbnailService,
  constructMockedItem,
  expectValidUrls,
} from './fixtures/itemThumbnailService';

const mockedItemsId = [
  constructMockedItem('item1'),
  constructMockedItem('item2'),
  constructMockedItem('item3'),
];
const stubItemThumbnailService = StubItemThumbnailService();

describe('ItemThumbnailService', () => {
  describe('getUrlsByItems', () => {
    it('Retrieve the medium and small URLs if no size is specified', async () => {
      const expectedSizes = [ThumbnailSize.Medium, ThumbnailSize.Small];
      const results = await stubItemThumbnailService.getUrlsByItems(mockedItemsId);
      expectValidUrls(mockedItemsId, results, expectedSizes);
    });

    it('Retrieve the specified size', async () => {
      const expectedSizes = [ThumbnailSize.Medium, ThumbnailSize.Small];

      expectedSizes.forEach(async (size) => {
        const results = await stubItemThumbnailService.getUrlsByItems(mockedItemsId, [size]);
        expectValidUrls(mockedItemsId, results, [size]);
      });
    });

    it('Retrieve the specified sizes', async () => {
      const expectedSizes = [ThumbnailSize.Medium, ThumbnailSize.Small];

      const results = await stubItemThumbnailService.getUrlsByItems(mockedItemsId, expectedSizes);
      expectValidUrls(mockedItemsId, results, expectedSizes);
    });

    it('Empty item ids array should return empty object', async () => {
      expect(await stubItemThumbnailService.getUrlsByItems([])).toEqual({});
    });

    it('Empty sizes array should return empty object', async () => {
      expect(await stubItemThumbnailService.getUrlsByItems(mockedItemsId, [])).toEqual({});
    });
  });
});
