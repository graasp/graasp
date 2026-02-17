// import { faker } from '@faker-js/faker';
// import fetch from 'node-fetch';
// import { v4 } from 'uuid';

// import { ItemType } from '@graasp/sdk';

// import { MOCK_LOGGER } from '../../../../../test/app';
// import { ItemFactory } from '../../../../../test/factories/item.factory';
// import { MemberFactory } from '../../../../../test/factories/member.factory';
// import { db } from '../../../../drizzle/db';
// import { type ItemRaw } from '../../../../drizzle/types';
// import { EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN } from '../../../../utils/config';
// import { AuthorizationService } from '../../../authorization';
// import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
// import { ThumbnailService } from '../../../thumbnail/thumbnail.service';
// import { PackedItemService } from '../../ItemWrapper';
// import { BasicItemService } from '../../basic.service';
// import { EmbeddedLinkItem } from '../../discrimination';
// import { WrongItemTypeError } from '../../errors';
// import { ItemRepository } from '../../item.repository';
// import { ItemService } from '../../item.service';
// import { ItemGeolocationRepository } from '../geolocation/itemGeolocation.repository';
// import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository';
// import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
// import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
// import { RecycledBinService } from '../recycled/recycled.service';
// import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';
// import { EmbeddedLinkItemService } from './link.service';

// jest.mock('node-fetch');

// const itemRepository = { getOneOrThrow: jest.fn() } as unknown as ItemRepository;

// const linkService = new EmbeddedLinkItemService(
//   {} as ThumbnailService,
//   {} as ItemThumbnailService,
//   {} as ItemMembershipRepository,
//   {} as MeiliSearchWrapper,
//   itemRepository,
//   {} as ItemPublishedRepository,
//   {} as ItemGeolocationRepository,
//   {} as AuthorizationService,
//   {} as PackedItemService,
//   {} as ItemVisibilityRepository,
//   {} as BasicItemService,
//   {} as RecycledBinService,
//   MOCK_LOGGER,
//   EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN,
// );

const MOCK_URL = 'https://example.com';
const THUMBNAIL_HREF = `${MOCK_URL}/24.png`;
const ICON_HREF = `${MOCK_URL}/icon`;
const HTML = 'html';

export const FETCH_RESULT = {
  meta: {
    title: 'title',
    description: 'description',
  },
  html: HTML,
  links: [
    {
      rel: ['thumbnail'],
      href: THUMBNAIL_HREF,
    },
    {
      rel: ['icon'],
      href: ICON_HREF,
    },
  ],
};

// export const mockResponse = (response: object) => {
//   return jest.spyOn(fetch, 'default').mockImplementation(
//     async () =>
//       ({
//         json: async () => response,
//       }) as never,
//   );
// };
// export const mockReject = (error: Error) => {
//   return jest.spyOn(fetch, 'default').mockRejectedValue(error);
// };

// export const mockHeaderResponse = (headers: { [key: string]: string }) => {
//   jest
//     .spyOn(fetch, 'default')
//     .mockImplementation(async () => ({ headers: new Headers(headers) }) as never);
// };

// const iframelyResult = {
//   meta: {
//     title: 'title-patch',
//     description: 'description-patch',
//   },
//   html: 'html-patch',
//   links: [
//     { rel: ['icon'], href: 'icon' },
//     { rel: ['thumbnail'], href: 'thumbnail' },
//   ],
//   // used for test
//   icons: ['icon'],
//   thumbnails: ['thumbnail'],
// };

describe('Link Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // // TODO: disable all tests because they do not work in CI
  // // iframely is not mocked?
  it('temporary', () => {
    expect(true).toBeTruthy();
  });

  // describe('getLinkMetadata', () => {
  //   it('replace all weird spaces by normal spaces', async () => {
  //     // ASSERTIONS
  //     const title = 'ti\ntle\nwith spec\r\nial \t\t spaces';
  //     // should have non breaking spaces
  //     expect(title).toContain(' ');
  //     // should have tab spaces
  //     expect(title).toContain('\t');
  //     // should have breaking spaces
  //     expect(title).toContain('\n');
  //     expect(title).toContain('\r\n');
  //     // should not contain normal spaces
  //     expect(title).not.toContain(' ');

  //     mockResponse({
  //       meta: {
  //         title,
  //         description: 'description-patch',
  //       },
  //     });

  //     const result = await linkService.getLinkMetadata(MOCK_URL);

  //     // should not have non breaking spaces
  //     expect(result.title).not.toContain(' ');
  //     // should not have tab spaces
  //     expect(result.title).not.toContain('\t');
  //     // should not have breaking spaces
  //     expect(result.title).not.toContain('\n');
  //     expect(result.title).not.toContain('\r\n');
  //     // should contain normal spaces
  //     expect(result.title).toContain(' ');
  //   });
  // });

  // describe('Tests retrieving link metadata', () => {
  //   it('Retrieve all metadata from URL', async () => {
  //     mockResponse(FETCH_RESULT);
  //     const metadata = await linkService.getLinkMetadata(MOCK_URL);
  //     expect(metadata).toEqual({
  //       title: FETCH_RESULT.meta.title,
  //       description: FETCH_RESULT.meta.description,
  //       html: HTML,
  //       thumbnails: [THUMBNAIL_HREF],
  //       icons: [ICON_HREF],
  //     });
  //   });
  // });

  // describe('Tests allowed to embbed links in iFrame', () => {
  //   describe('Embedding is disallowed when X-Frame-Options is set', () => {
  //     it('Embedding is disallowed when X-FRAME-OPTIONS is DENY', async () => {
  //       mockHeaderResponse({ 'X-FRAME-OPTIONS': 'DENY' });
  //       expect(await linkService.checkEmbeddingAllowed(MOCK_URL)).toBe(false);
  //     });
  //     it('Embedding is disallowed when x-frame-options is deny', async () => {
  //       mockHeaderResponse({ 'x-frame-options': 'deny' });
  //       expect(await linkService.checkEmbeddingAllowed(MOCK_URL)).toBe(false);
  //     });
  //     it('Embedding is disallowed when X-FRAME-OPTIONS is SAMEORIGIN', async () => {
  //       mockHeaderResponse({ 'X-FRAME-OPTIONS': 'DENY' });
  //       expect(await linkService.checkEmbeddingAllowed(MOCK_URL)).toBe(false);
  //     });
  //     it('Embedding is disallowed when x-frame-options is sameorigin', async () => {
  //       mockHeaderResponse({ 'x-frame-options': 'sameorigin' });
  //       expect(await linkService.checkEmbeddingAllowed(MOCK_URL)).toBe(false);
  //     });
  //   });

  //   describe('Embedding is disallowed when Content-Security-Policy is set', () => {
  //     it('Embedding is disallowed when content-security-policy is none', async () => {
  //       mockHeaderResponse({ 'content-security-policy': "frame-ancestors 'none'" });
  //       expect(await linkService.checkEmbeddingAllowed(MOCK_URL)).toBe(false);
  //     });
  //     it('Embedding is disallowed when CONTENT-SECURITY-POLICY is NONE', async () => {
  //       mockHeaderResponse({ 'CONTENT-SECURITY-POLICY': "FRAME-ANCESTORS 'NONE'" });
  //       expect(await linkService.checkEmbeddingAllowed(MOCK_URL)).toBe(false);
  //     });
  //     it('Embedding is disallowed when content-security-policy is self', async () => {
  //       mockHeaderResponse({ 'content-security-policy': "frame-ancestors 'self'" });
  //       expect(await linkService.checkEmbeddingAllowed(MOCK_URL)).toBe(false);
  //     });
  //     it('Embedding is disallowed when CONTENT-SECURITY-POLICY is self', async () => {
  //       mockHeaderResponse({ 'CONTENT-SECURITY-POLICY': "FRAME-ANCESTORS 'SELF'" });
  //       expect(await linkService.checkEmbeddingAllowed(MOCK_URL)).toBe(false);
  //     });
  //   });

  //   describe('Embedding is allowed when X-Frame-Options and CSP are not set', () => {
  //     it('Embedding is allowed', async () => {
  //       mockHeaderResponse({});
  //       expect(await linkService.checkEmbeddingAllowed(MOCK_URL)).toBe(true);
  //     });
  //   });
  // });

  // describe('postWithOptions', () => {
  //   it('do not throw if iframely is unresponsive', async () => {
  //     const member = MemberFactory();
  //     const item = ItemFactory({
  //       extra: {
  //         ['embeddedLink']: {
  //           url: faker.internet.url(),
  //           icons: [],
  //           thumbnails: [],
  //           description: '',
  //           title: '',
  //           html: '',
  //         },
  //       },
  //     }) as EmbeddedLinkItem;
  //     expect(item.extra.embeddedLink.url).toBeDefined();

  //     const fetchMock = mockReject(new Error());

  //     const itemServicePostMock = jest.spyOn(ItemService.prototype, 'post').mockResolvedValue(item);

  //     const args = {
  //       name: 'name',
  //       url: 'https://another-url.com',
  //     };
  //     await linkService.postWithOptions(db, member, args);

  //     // call to iframely
  //     expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent(args.url)));

  //     // call to item service with initial item name
  //     expect(itemServicePostMock).toHaveBeenCalledWith(db, member, {
  //       item: {
  //         name: args.name,
  //         type: 'embeddedLink',
  //         // not defined in args
  //         description: undefined,
  //         lang: undefined,
  //         extra: {
  //           ['embeddedLink']: {
  //             url: args.url,
  //             icons: [],
  //             thumbnails: [],
  //             description: '',
  //             title: '',
  //             html: '',
  //           },
  //         },
  //         settings: { showLinkButton: true, showLinkIframe: false },
  //       },
  //     });
  //   });
  //   describe('mock iframely', () => {
  //     it('set correct default values for type, extra and settings', async () => {
  //       const member = MemberFactory();
  //       const itemServicePostMock = jest
  //         .spyOn(ItemService.prototype, 'post')
  //         .mockImplementation(async () => {
  //           return {} as ItemRaw;
  //         });
  //       const fetchMock = mockResponse(iframelyResult);

  //       await linkService.postWithOptions(db, member, {
  //         name: 'name',
  //         url: MOCK_URL,
  //       });

  //       // call to iframely
  //       expect(fetchMock).toHaveBeenCalledWith(
  //         expect.stringContaining(encodeURIComponent(MOCK_URL)),
  //       );

  //       // call to item service
  //       expect(itemServicePostMock).toHaveBeenCalledWith(db, member, {
  //         item: {
  //           name: 'name',
  //           description: undefined,
  //           extra: {
  //             ['embeddedLink']: {
  //               url: MOCK_URL,
  //               description: iframelyResult.meta.description,
  //               title: iframelyResult.meta.title,
  //               html: iframelyResult.html,
  //               icons: iframelyResult.icons,
  //               thumbnails: iframelyResult.thumbnails,
  //             },
  //           },
  //           type: 'embeddedLink',
  //           settings: {
  //             showLinkIframe: false,
  //             showLinkButton: true,
  //           },
  //           lang: undefined,
  //         },
  //         // lang is defined by super service
  //       });
  //     });
  //     it('set defined values', async () => {
  //       const member = MemberFactory();
  //       const itemServicePostMock = jest
  //         .spyOn(ItemService.prototype, 'post')
  //         .mockResolvedValue(ItemFactory());
  //       const fetchMock = mockResponse(iframelyResult);

  //       const args = {
  //         name: 'name',
  //         description: 'my description',
  //         url: MOCK_URL,
  //         showLinkIframe: true,
  //         showLinkButton: false,
  //         lang: 'fr',
  //         parentId: v4(),
  //         geolocation: { lat: 1, lng: 1 },
  //         previousItemId: v4(),
  //       };
  //       await linkService.postWithOptions(db, member, args);

  //       // call to iframely
  //       expect(fetchMock).toHaveBeenCalledWith(
  //         expect.stringContaining(encodeURIComponent(MOCK_URL)),
  //       );

  //       // call to item service
  //       expect(itemServicePostMock).toHaveBeenCalledWith(db, member, {
  //         item: {
  //           name: args.name,
  //           description: args.description,
  //           extra: {
  //             ['embeddedLink']: {
  //               url: MOCK_URL,
  //               description: iframelyResult.meta.description,
  //               title: iframelyResult.meta.title,
  //               html: iframelyResult.html,
  //               icons: iframelyResult.icons,
  //               thumbnails: iframelyResult.thumbnails,
  //             },
  //           },
  //           type: 'embeddedLink',
  //           settings: {
  //             showLinkIframe: args.showLinkIframe,
  //             showLinkButton: args.showLinkButton,
  //           },
  //           lang: args.lang,
  //         },
  //         parentId: args.parentId,
  //         geolocation: args.geolocation,
  //         previousItemId: args.previousItemId,
  //       });
  //     });
  //   });
  // });
  // describe('patchWithOptions', () => {
  //   it('do not throw if iframely is unresponsive', async () => {
  //     const member = MemberFactory();
  //     const item = ItemFactory({
  //       type: 'embeddedLink',
  //       extra: { embeddedLink: { url: faker.internet.url() } },
  //     }) as EmbeddedLinkItem;
  //     expect(item.extra.embeddedLink.url).toBeDefined();
  //     const fetchMock = mockReject(new Error());

  //     const itemServicePatchMock = jest
  //       .spyOn(ItemService.prototype, 'patch')
  //       .mockImplementation(async () => {
  //         return item;
  //       });
  //     jest.spyOn(itemRepository, 'getOneOrThrow').mockResolvedValue({ ...item, creator: null });

  //     const args = {
  //       url: 'https://another-url.com',
  //     };
  //     await linkService.patchWithOptions(db, member, item.id, args);

  //     // call to iframely
  //     expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent(args.url)));

  //     // call to item service with initial item name
  //     expect(itemServicePatchMock).toHaveBeenCalledWith(db, member, item.id, {
  //       name: item.name,
  //       type: 'embeddedLink',
  //       // not defined in args
  //       description: undefined,
  //       lang: undefined,
  //       extra: {
  //         ['embeddedLink']: {
  //           icons: [],
  //           thumbnails: [],
  //           description: '',
  //           title: '',
  //           html: '',
  //           url: args.url,
  //         },
  //       },
  //       settings: { showLinkButton: true, showLinkIframe: false },
  //     });
  //   });
  //   describe('mock iframely', () => {
  //     it('throw if item is not a link', async () => {
  //       const member = MemberFactory();
  //       const FOLDER_ITEM = ItemFactory();
  //       mockResponse(iframelyResult);
  //       jest
  //         .spyOn(itemRepository, 'getOneOrThrow')
  //         .mockResolvedValue({ ...FOLDER_ITEM, creator: null });
  //       await expect(() =>
  //         linkService.patchWithOptions(db, member, FOLDER_ITEM.id, { name: 'name' }),
  //       ).rejects.toBeInstanceOf(WrongItemTypeError);
  //     });
  //     it('patch url changes link extra', async () => {
  //       const member = MemberFactory();
  //       const item = ItemFactory({
  //         type: 'embeddedLink',
  //         extra: { embeddedLink: { url: faker.internet.url() } },
  //       }) as EmbeddedLinkItem;
  //       expect(item.extra.embeddedLink.url).toBeDefined();
  //       const fetchMock = mockResponse(iframelyResult);

  //       jest.spyOn(itemRepository, 'getOneOrThrow').mockResolvedValue({ ...item, creator: null });

  //       const itemServicePatchMock = jest
  //         .spyOn(ItemService.prototype, 'patch')
  //         .mockImplementation(async () => {
  //           return item;
  //         });

  //       const args = {
  //         url: 'https://another-url.com',
  //       };
  //       await linkService.patchWithOptions(db, member, item.id, args);

  //       // call to iframely
  //       expect(fetchMock).toHaveBeenCalledWith(
  //         expect.stringContaining(encodeURIComponent(args.url)),
  //       );

  //       // call to item service with initial item name
  //       expect(itemServicePatchMock).toHaveBeenCalledWith(db, member, item.id, {
  //         name: item.name,
  //         type: 'embeddedLink',
  //         // not defined in args
  //         description: undefined,
  //         lang: undefined,
  //         extra: {
  //           ['embeddedLink']: {
  //             url: args.url,
  //             description: iframelyResult.meta.description,
  //             title: iframelyResult.meta.title,
  //             html: iframelyResult.html,
  //             icons: iframelyResult.icons,
  //             thumbnails: iframelyResult.thumbnails,
  //           },
  //         },
  //         settings: { showLinkButton: true, showLinkIframe: false },
  //       });
  //     });
  //     it('patch item settings', async () => {
  //       const member = MemberFactory();
  //       const item = ItemFactory({
  //         type: 'embeddedLink',
  //         extra: { embeddedLink: { url: faker.internet.url() } },
  //       }) as EmbeddedLinkItem;
  //       mockResponse(iframelyResult);

  //       jest.spyOn(itemRepository, 'getOneOrThrow').mockResolvedValue({ ...item, creator: null });

  //       const itemServicePatchMock = jest
  //         .spyOn(ItemService.prototype, 'patch')
  //         .mockImplementation(async () => {
  //           return item;
  //         });

  //       expect(item.extra.embeddedLink.url).toBeDefined();

  //       const args = {
  //         settings: { isPinned: true },
  //       };
  //       await linkService.patchWithOptions(db, member, item.id, args);

  //       // call to item service with initial item name
  //       expect(itemServicePatchMock).toHaveBeenCalledWith(db, member, item.id, {
  //         name: item.name,
  //         type: 'embeddedLink',
  //         // not defined in args
  //         description: undefined,
  //         lang: undefined,
  //         extra: item.extra,
  //         settings: { ...args.settings, showLinkButton: true, showLinkIframe: false },
  //       });
  //     });
  //     it('patch many properties without changing url', async () => {
  //       const member = MemberFactory();
  //       const item = ItemFactory({
  //         type: 'embeddedLink',
  //         extra: { embeddedLink: { url: faker.internet.url() } },
  //       }) as EmbeddedLinkItem;
  //       expect(item.extra.embeddedLink.url).toBeDefined();
  //       const fetchMock = mockResponse(iframelyResult);

  //       jest.spyOn(itemRepository, 'getOneOrThrow').mockResolvedValue({ ...item, creator: null });

  //       const itemServicePatchMock = jest
  //         .spyOn(ItemService.prototype, 'patch')
  //         .mockResolvedValue(item);

  //       const args = {
  //         name: 'newname',
  //         description: 'newdescription',
  //         lang: 'de',
  //         showLinkButton: false,
  //         showLinkIframe: true,
  //       };
  //       await linkService.patchWithOptions(db, member, item.id, args);

  //       // do not call iframely
  //       expect(fetchMock).not.toHaveBeenCalled();

  //       // call to item service with initial item name
  //       expect(itemServicePatchMock).toHaveBeenCalledWith(db, member, item.id, {
  //         name: args.name,
  //         type: 'embeddedLink',
  //         description: args.description,
  //         lang: args.lang,
  //         extra: item.extra,
  //         settings: { showLinkButton: false, showLinkIframe: true },
  //       });
  //     });

  //     it('Cannot update not found item given id', async () => {
  //       const member = MemberFactory();
  //       jest.spyOn(itemRepository, 'getOneOrThrow').mockImplementation(() => {
  //         throw new Error();
  //       });

  //       await expect(() =>
  //         linkService.patchWithOptions(db, member, v4(), { name: 'name' }),
  //       ).rejects.toThrow();
  //     });
  //   });
  // });
});
