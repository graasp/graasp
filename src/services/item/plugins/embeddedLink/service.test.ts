import fetch from 'node-fetch';
import { v4 } from 'uuid';

import { FolderItemFactory, ItemType, LinkItemFactory } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../test/app';
import { Item } from '../../../../drizzle/types';
import { MinimalMember } from '../../../../types';
import { EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN } from '../../../../utils/config';
import { ThumbnailService } from '../../../thumbnail/service';
import { EmbeddedLinkItem } from '../../discrimination';
import { WrongItemTypeError } from '../../errors';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../service';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from '../thumbnail/service';
import { EmbeddedLinkItemService } from './service';

jest.mock('node-fetch');

const linkService = new EmbeddedLinkItemService(
  {} as unknown as ThumbnailService,
  {} as unknown as ItemThumbnailService,
  {} as MeiliSearchWrapper,
  MOCK_LOGGER,
  EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN,
);
const id = v4();
const MOCK_ITEM = LinkItemFactory({ id }) as unknown as EmbeddedLinkItem;
const MOCK_URL = 'http://example.com';

const iframelyResult = {
  meta: {
    title: 'title-patch',
    description: 'description-patch',
  },
  html: 'html-patch',
  links: [
    { rel: ['icon'], href: 'icon' },
    { rel: ['thumbnail'], href: 'thumbnail' },
  ],
  // used for test
  icons: ['icon'],
  thumbnails: ['thumbnail'],
};

const MOCK_MEMBER = {} as MinimalMember;
const itemRepository = {
  getOneOrThrow: async () => {
    return MOCK_ITEM;
  },
} as unknown as ItemRepository;

describe('Link Service', () => {
  let fetchMock: jest.SpyInstance;

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLinkMetadata', () => {
    it('replace all weird spaces by normal spaces', async () => {
      // ASSERTIONS
      const title = 'ti\ntle\nwith spec\r\nial \t\t spaces';
      // should have non breaking spaces
      expect(title).toContain(' ');
      // should have tab spaces
      expect(title).toContain('\t');
      // should have breaking spaces
      expect(title).toContain('\n');
      expect(title).toContain('\r\n');
      // should not contain normal spaces
      expect(title).not.toContain(' ');

      fetchMock = (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
        return {
          json: async () => ({
            meta: {
              title,
              description: 'description-patch',
            },
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
      });

      const result = await linkService.getLinkMetadata(MOCK_URL);

      // should not have non breaking spaces
      expect(result.title).not.toContain(' ');
      // should not have tab spaces
      expect(result.title).not.toContain('\t');
      // should not have breaking spaces
      expect(result.title).not.toContain('\n');
      expect(result.title).not.toContain('\r\n');
      // should contain normal spaces
      expect(result.title).toContain(' ');
    });
  });

  describe('postWithOptions', () => {
    it('do not throw if iframely is unresponsive', async () => {
      fetchMock = (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(new Error());

      const itemServicePostMock = jest
        .spyOn(ItemService.prototype, 'post')
        .mockImplementation(async () => {
          return MOCK_ITEM;
        });

      expect(MOCK_ITEM.extra.embeddedLink.url).toBeDefined();

      const args = {
        name: 'name',
        url: 'https://another-url.com',
      };
      await linkService.postWithOptions(app.db, MOCK_MEMBER, args);

      // call to iframely
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent(args.url)));

      // call to item service with initial item name
      expect(itemServicePostMock).toHaveBeenCalledWith(app.db, MOCK_MEMBER, {
        item: {
          name: args.name,
          type: ItemType.LINK,
          // not defined in args
          description: undefined,
          lang: undefined,
          extra: {
            [ItemType.LINK]: {
              url: args.url,
              icons: [],
              thumbnails: [],
              description: '',
              title: '',
              html: '',
            },
          },
          settings: { showLinkButton: true, showLinkIframe: false },
        },
      });
    });
    describe('mock iframely', () => {
      beforeEach(() => {
        fetchMock = (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return { json: async () => iframelyResult } as any;
        });
      });

      it('set correct default values for type, extra and settings', async () => {
        const itemServicePostMock = jest
          .spyOn(ItemService.prototype, 'post')
          .mockImplementation(async () => {
            return {} as Item;
          });

        await linkService.postWithOptions(app.db, MOCK_MEMBER, {
          name: 'name',
          url: MOCK_URL,
        });

        // call to iframely
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining(encodeURIComponent(MOCK_URL)),
        );

        // call to item service
        expect(itemServicePostMock).toHaveBeenCalledWith(app.db, MOCK_MEMBER, {
          item: {
            name: 'name',
            description: undefined,
            extra: {
              [ItemType.LINK]: {
                url: MOCK_URL,
                description: iframelyResult.meta.description,
                title: iframelyResult.meta.title,
                html: iframelyResult.html,
                icons: iframelyResult.icons,
                thumbnails: iframelyResult.thumbnails,
              },
            },
            type: ItemType.LINK,
            settings: {
              showLinkIframe: false,
              showLinkButton: true,
            },
            lang: undefined,
          },
          // lang is defined by super service
        });
      });
      it('set defined values', async () => {
        const itemServicePostMock = jest
          .spyOn(ItemService.prototype, 'post')
          .mockImplementation(async () => {
            return {} as any;
          });

        const args = {
          name: 'name',
          description: 'my description',
          url: MOCK_URL,
          showLinkIframe: true,
          showLinkButton: false,
          lang: 'fr',
          parentId: v4(),
          geolocation: { lat: 1, lng: 1 },
          previousItemId: v4(),
        };
        await linkService.postWithOptions(app.db, MOCK_MEMBER, args);

        // call to iframely
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining(encodeURIComponent(MOCK_URL)),
        );

        // call to item service
        expect(itemServicePostMock).toHaveBeenCalledWith(app.db, MOCK_MEMBER, {
          item: {
            name: args.name,
            description: args.description,
            extra: {
              [ItemType.LINK]: {
                url: MOCK_URL,
                description: iframelyResult.meta.description,
                title: iframelyResult.meta.title,
                html: iframelyResult.html,
                icons: iframelyResult.icons,
                thumbnails: iframelyResult.thumbnails,
              },
            },
            type: ItemType.LINK,
            settings: {
              showLinkIframe: args.showLinkIframe,
              showLinkButton: args.showLinkButton,
            },
            lang: args.lang,
          },
          parentId: args.parentId,
          geolocation: args.geolocation,
          previousItemId: args.previousItemId,
        });
      });
    });
  });
  describe('patchWithOptions', () => {
    it('do not throw if iframely is unresponsive', async () => {
      fetchMock = (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(new Error());

      const itemServicePatchMock = jest
        .spyOn(ItemService.prototype, 'patch')
        .mockImplementation(async () => {
          return MOCK_ITEM;
        });

      expect(MOCK_ITEM.extra.embeddedLink.url).toBeDefined();

      const args = {
        url: 'https://another-url.com',
      };
      await linkService.patchWithOptions(app.db, MOCK_MEMBER, MOCK_ITEM.id, args);

      // call to iframely
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent(args.url)));

      // call to item service with initial item name
      expect(itemServicePatchMock).toHaveBeenCalledWith(
        app.db,
        MOCK_MEMBER,

        MOCK_ITEM.id,
        {
          name: MOCK_ITEM.name,
          type: ItemType.LINK,
          // not defined in args
          description: undefined,
          lang: undefined,
          extra: {
            [ItemType.LINK]: {
              icons: [],
              thumbnails: [],
              description: '',
              title: '',
              html: '',
              url: args.url,
            },
          },
          settings: { showLinkButton: true, showLinkIframe: false },
        },
      );
    });
    describe('mock iframely', () => {
      beforeEach(() => {
        fetchMock = (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return { json: async () => iframelyResult } as any;
        });
      });

      it('throw if item is not a link', async () => {
        const FOLDER_ITEM = FolderItemFactory();
        await expect(() =>
          linkService.patchWithOptions(app.db, MOCK_MEMBER, FOLDER_ITEM.id, { name: 'name' }),
        ).rejects.toBeInstanceOf(WrongItemTypeError);
      });
      it('patch url changes link extra', async () => {
        const itemServicePatchMock = jest
          .spyOn(ItemService.prototype, 'patch')
          .mockImplementation(async () => {
            return MOCK_ITEM;
          });

        expect(MOCK_ITEM.extra.embeddedLink.url).toBeDefined();

        const args = {
          url: 'https://another-url.com',
        };
        await linkService.patchWithOptions(app.db, MOCK_MEMBER, MOCK_ITEM.id, args);

        // call to iframely
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining(encodeURIComponent(args.url)),
        );

        // call to item service with initial item name
        expect(itemServicePatchMock).toHaveBeenCalledWith(
          app.db,
          MOCK_MEMBER,

          MOCK_ITEM.id,
          {
            name: MOCK_ITEM.name,
            type: ItemType.LINK,
            // not defined in args
            description: undefined,
            lang: undefined,
            extra: {
              [ItemType.LINK]: {
                url: args.url,
                description: iframelyResult.meta.description,
                title: iframelyResult.meta.title,
                html: iframelyResult.html,
                icons: iframelyResult.icons,
                thumbnails: iframelyResult.thumbnails,
              },
            },
            settings: { showLinkButton: true, showLinkIframe: false },
          },
        );
      });
      it('patch item settings', async () => {
        const itemServicePatchMock = jest
          .spyOn(ItemService.prototype, 'patch')
          .mockImplementation(async () => {
            return MOCK_ITEM;
          });

        expect(MOCK_ITEM.extra.embeddedLink.url).toBeDefined();

        const args = {
          settings: { isPinned: true },
        };
        await linkService.patchWithOptions(app.db, MOCK_MEMBER, MOCK_ITEM.id, args);

        // call to item service with initial item name
        expect(itemServicePatchMock).toHaveBeenCalledWith(
          app.db,
          MOCK_MEMBER,

          MOCK_ITEM.id,
          {
            name: MOCK_ITEM.name,
            type: ItemType.LINK,
            // not defined in args
            description: undefined,
            lang: undefined,
            extra: MOCK_ITEM.extra,
            settings: { ...args.settings, showLinkButton: true, showLinkIframe: false },
          },
        );
      });
      it('patch many properties without changing url', async () => {
        const itemServicePatchMock = jest
          .spyOn(ItemService.prototype, 'patch')
          .mockImplementation(async () => {
            return MOCK_ITEM;
          });

        expect(MOCK_ITEM.extra.embeddedLink.url).toBeDefined();

        const args = {
          name: 'newname',
          description: 'newdescription',
          lang: 'de',
          showLinkButton: false,
          showLinkIframe: true,
        };
        await linkService.patchWithOptions(app.db, MOCK_MEMBER, MOCK_ITEM.id, args);

        // do not call iframely
        expect(fetchMock).not.toHaveBeenCalled();

        // call to item service with initial item name
        expect(itemServicePatchMock).toHaveBeenCalledWith(
          app.db,
          MOCK_MEMBER,

          MOCK_ITEM.id,
          {
            name: args.name,
            type: ItemType.LINK,
            description: args.description,
            lang: args.lang,
            extra: MOCK_ITEM.extra,
            settings: { showLinkButton: false, showLinkIframe: true },
          },
        );
      });

      it('Cannot update not found item given id', async () => {
        jest.spyOn(itemRepository, 'getOneOrThrow').mockImplementation(() => {
          throw new Error();
        });

        await expect(() =>
          linkService.patchWithOptions(app.db, MOCK_MEMBER, v4(), { name: 'name' }),
        ).rejects.toThrow();
      });
    });
  });
});
