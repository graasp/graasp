import { v4 } from 'uuid';

import { FolderItemFactory, ThumbnailSize } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../test/app';
import { Repositories } from '../../../../utils/repositories';
import { ThumbnailService } from '../../../thumbnail/service';
import { Item } from '../../entities/Item';
import { ItemService } from '../../service';
import { ItemThumbnailService } from './service';
import {
  constructMockedItem,
  constructMockedUrl,
  expectValidUrls,
} from './test/fixtures/itemThumbnailService';

const mockedItemsId = [
  constructMockedItem('item1'),
  constructMockedItem('item2'),
  constructMockedItem('item3'),
];

const dummyItemService = {
  get: jest.fn(),
} as unknown as ItemService;
const stubThumbnailService = {
  getUrl: constructMockedUrl,
} as unknown as ThumbnailService;

export const itemThumbnailService = new ItemThumbnailService(
  dummyItemService,
  stubThumbnailService,
  MOCK_LOGGER,
);

const MOCK_REPOSITORIES = {} as Repositories;

describe('ItemThumbnailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('getUrl', () => {
    it('return url for item and size', async () => {
      const MOCK_ITEM = FolderItemFactory({ settings: { hasThumbnail: true } }) as unknown as Item;
      jest.spyOn(dummyItemService, 'get').mockResolvedValue(MOCK_ITEM);

      const size = ThumbnailSize.Large;
      const result = await itemThumbnailService.getUrl(undefined, MOCK_REPOSITORIES, {
        size,
        itemId: mockedItemsId[0].id,
      });
      expect(result).toEqual(constructMockedUrl({ size, id: mockedItemsId[0].id }));
    });
    it('return null for item without thumbnail', async () => {
      const MOCK_ITEM = FolderItemFactory({ settings: { hasThumbnail: false } }) as unknown as Item;
      jest.spyOn(dummyItemService, 'get').mockResolvedValue(MOCK_ITEM);

      const result = await itemThumbnailService.getUrl(undefined, MOCK_REPOSITORIES, {
        size: ThumbnailSize.Large,
        itemId: mockedItemsId[0].id,
      });
      expect(result).toBeNull();
    });
    it('throw if cannot get item', async () => {
      jest.spyOn(dummyItemService, 'get').mockRejectedValue(new Error());
      await expect(() =>
        itemThumbnailService.getUrl(undefined, MOCK_REPOSITORIES, {
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

    it('Retrieve the specified size', async () => {
      const expectedSizes = [ThumbnailSize.Medium, ThumbnailSize.Small];

      expectedSizes.forEach(async (size) => {
        const results = await itemThumbnailService.getUrlsByItems(mockedItemsId, [size]);
        expectValidUrls(mockedItemsId, results, [size]);
      });
    });

    it('Retrieve the specified sizes', async () => {
      const expectedSizes = [ThumbnailSize.Medium, ThumbnailSize.Small];

      const results = await itemThumbnailService.getUrlsByItems(mockedItemsId, expectedSizes);
      expectValidUrls(mockedItemsId, results, expectedSizes);
    });

    it('Empty item ids array should return empty object', async () => {
      expect(await itemThumbnailService.getUrlsByItems([])).toEqual({});
    });

    it('Empty sizes array should return empty object', async () => {
      expect(await itemThumbnailService.getUrlsByItems(mockedItemsId, [])).toEqual({});
    });
  });
});
