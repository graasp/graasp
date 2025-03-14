import { v4 } from 'uuid';

import { AppItemFactory, FolderItemFactory, ItemType } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../test/app.js';
import { Item } from '../../../../drizzle/types.js';
import { MinimalMember } from '../../../../types.js';
import { ThumbnailService } from '../../../thumbnail/service.js';
import { AppItem } from '../../discrimination.js';
import { WrongItemTypeError } from '../../errors.js';
import { ItemRepository } from '../../repository.js';
import { ItemService } from '../../service.js';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch.js';
import { ItemThumbnailService } from '../thumbnail/service.js';
import { AppItemService } from './appItemService.js';

const appService = new AppItemService(
  {} as unknown as ThumbnailService,
  {} as unknown as ItemThumbnailService,
  {} as MeiliSearchWrapper,
  MOCK_LOGGER,
);
const id = v4();
const MOCK_ITEM = AppItemFactory({ id }) as unknown as AppItem;
const MOCK_URL = 'http://example.com';

const MOCK_MEMBER = {} as MinimalMember;
const itemRepository = {
  getOneOrThrow: async () => {
    return MOCK_ITEM;
  },
} as unknown as ItemRepository;

describe('App Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('postWithOptions', () => {
    it('set correct default values for type, extra and settings', async () => {
      const itemServicePostMock = jest
        .spyOn(ItemService.prototype, 'post')
        .mockImplementation(async () => {
          return {} as Item;
        });

      await appService.postWithOptions(app.db, MOCK_MEMBER, {
        name: 'name',
        url: MOCK_URL,
      });

      // call to item service
      expect(itemServicePostMock).toHaveBeenCalledWith(app.db, MOCK_MEMBER, {
        item: {
          name: 'name',
          description: undefined,
          extra: {
            [ItemType.APP]: {
              url: MOCK_URL,
            },
          },
          type: ItemType.APP,
          lang: undefined,
        },
        // lang is defined by super service
      });
    });
    it('set defined values', async () => {
      const itemServicePostMock = jest
        .spyOn(ItemService.prototype, 'post')
        .mockImplementation(async () => {
          return {} as Item;
        });

      const args = {
        name: 'name',
        description: 'my description',
        url: MOCK_URL,
        lang: 'fr',
        parentId: v4(),
        geolocation: { lat: 1, lng: 1 },
        previousItemId: v4(),
      };
      await appService.postWithOptions(app.db, MOCK_MEMBER, args);

      // call to item service
      expect(itemServicePostMock).toHaveBeenCalledWith(app.db, MOCK_MEMBER, {
        item: {
          name: args.name,
          description: args.description,
          extra: {
            [ItemType.APP]: {
              url: MOCK_URL,
            },
          },
          type: ItemType.APP,
          lang: args.lang,
        },
        parentId: args.parentId,
        geolocation: args.geolocation,
        previousItemId: args.previousItemId,
      });
    });
  });
  describe('patch', () => {
    it('throw if item is not a app', async () => {
      const FOLDER_ITEM = FolderItemFactory();
      await expect(() =>
        appService.patch(app.db, MOCK_MEMBER, FOLDER_ITEM.id, { name: 'name' }),
      ).rejects.toBeInstanceOf(WrongItemTypeError);
    });
    it('patch item settings', async () => {
      const itemServicePatchMock = jest
        .spyOn(ItemService.prototype, 'patch')
        .mockImplementation(async () => {
          return MOCK_ITEM;
        });

      expect(MOCK_ITEM.extra.app.url).toBeDefined();

      const args = {
        settings: { isPinned: true },
      };
      await appService.patch(app.db, MOCK_MEMBER, MOCK_ITEM.id, args);

      // call to item service with initial item name
      expect(itemServicePatchMock).toHaveBeenCalledWith(app.db, MOCK_MEMBER, MOCK_ITEM.id, {
        settings: args.settings,
      });
    });
    it('patch many properties without changing url', async () => {
      const itemServicePatchMock = jest
        .spyOn(ItemService.prototype, 'patch')
        .mockImplementation(async () => {
          return MOCK_ITEM;
        });

      expect(MOCK_ITEM.extra.app.url).toBeDefined();

      const args = {
        name: 'newname',
        description: 'newdescription',
        lang: 'de',
      };
      await appService.patch(app.db, MOCK_MEMBER, MOCK_ITEM.id, args);

      // call to item service with initial item name
      expect(itemServicePatchMock).toHaveBeenCalledWith(app.db, MOCK_MEMBER, MOCK_ITEM.id, {
        name: args.name,
        description: args.description,
        lang: args.lang,
      });
    });

    it('Cannot update not found item given id', async () => {
      jest.spyOn(itemRepository, 'getOneOrThrow').mockImplementation(() => {
        throw new Error();
      });

      await expect(() =>
        appService.patch(app.db, MOCK_MEMBER, v4(), { name: 'name' }),
      ).rejects.toThrow();
    });
  });
});
