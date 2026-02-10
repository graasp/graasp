import { v4 } from 'uuid';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppItemFactory, FolderItemFactory } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../test/app.vitest';
import { MemberFactory } from '../../../../../test/factories/member.factory';
import { db } from '../../../../drizzle/db';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service';
import { AppItem, type ItemRaw } from '../../item';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../item.service';
import { PackedItemService } from '../../packedItem.dto';
import { ItemGeolocationRepository } from '../geolocation/itemGeolocation.repository';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { RecycledBinService } from '../recycled/recycled.service';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';
import { AppItemService } from './appItemService';

const itemRepository = {
  getOneOrThrow: async () => {
    return MOCK_ITEM;
  },
} as unknown as ItemRepository;

const appService = new AppItemService(
  {} as ThumbnailService,
  {} as ItemThumbnailService,
  {} as ItemMembershipRepository,
  {} as MeiliSearchWrapper,
  itemRepository,
  {} as ItemPublishedRepository,
  {} as ItemGeolocationRepository,
  {} as AuthorizedItemService,
  {} as PackedItemService,
  {} as ItemVisibilityRepository,
  {} as RecycledBinService,
  MOCK_LOGGER,
);

const id = v4();
const MOCK_ITEM = AppItemFactory({ id }) as unknown as AppItem;
const MOCK_URL = 'http://example.com';

const MOCK_MEMBER = MemberFactory();

describe('App Service', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('postWithOptions', () => {
    it('set correct default values for type, extra and settings', async () => {
      const itemServicePostMock = vi
        .spyOn(ItemService.prototype, 'post')
        .mockImplementation(async () => {
          return {} as ItemRaw;
        });

      await appService.postWithOptions(db, MOCK_MEMBER, {
        name: 'name',
        url: MOCK_URL,
      });

      // call to item service
      expect(itemServicePostMock).toHaveBeenCalledWith(db, MOCK_MEMBER, {
        item: {
          name: 'name',
          description: undefined,
          extra: {
            ['app']: {
              url: MOCK_URL,
            },
          },
          type: 'app',
          lang: undefined,
        },
        // lang is defined by super service
      });
    });
    it('set defined values', async () => {
      const itemServicePostMock = vi
        .spyOn(ItemService.prototype, 'post')
        .mockImplementation(async () => {
          return {} as ItemRaw;
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
      await appService.postWithOptions(db, MOCK_MEMBER, args);

      // call to item service
      expect(itemServicePostMock).toHaveBeenCalledWith(db, MOCK_MEMBER, {
        item: {
          name: args.name,
          description: args.description,
          extra: {
            ['app']: {
              url: MOCK_URL,
            },
          },
          type: 'app',
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
        appService.patch(db, MOCK_MEMBER, FOLDER_ITEM.id, { name: 'name' }),
      ).rejects.toThrow();
    });
    it('patch item settings', async () => {
      vi.spyOn(itemRepository, 'getOneOrThrow').mockResolvedValue(MOCK_ITEM);

      const itemServicePatchMock = vi
        .spyOn(ItemService.prototype, 'patch')
        .mockImplementation(async () => {
          return MOCK_ITEM;
        });

      expect(MOCK_ITEM.extra.app.url).toBeDefined();

      const args = {
        settings: { isPinned: true },
      };
      await appService.patch(db, MOCK_MEMBER, MOCK_ITEM.id, args);

      // call to item service with initial item name
      expect(itemServicePatchMock).toHaveBeenCalledWith(db, MOCK_MEMBER, MOCK_ITEM.id, {
        settings: args.settings,
      });
    });
    it('patch many properties without changing url', async () => {
      const itemServicePatchMock = vi
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
      await appService.patch(db, MOCK_MEMBER, MOCK_ITEM.id, args);

      // call to item service with initial item name
      expect(itemServicePatchMock).toHaveBeenCalledWith(db, MOCK_MEMBER, MOCK_ITEM.id, {
        name: args.name,
        description: args.description,
        lang: args.lang,
      });
    });

    it('Cannot update not found item given id', async () => {
      vi.spyOn(itemRepository, 'getOneOrThrow').mockImplementation(() => {
        throw new Error();
      });

      await expect(() =>
        appService.patch(db, MOCK_MEMBER, v4(), { name: 'name' }),
      ).rejects.toThrow();
    });
  });
});
