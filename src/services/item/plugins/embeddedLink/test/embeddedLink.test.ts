import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import fetch from 'node-fetch';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType, LinkItemFactory, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { ItemMembershipRepository } from '../../../../itemMembership/repository';
import { Actor } from '../../../../member/entities/member';
import { saveMember } from '../../../../member/test/fixtures/members';
import { ItemRepository } from '../../../repository';
import { ItemTestUtils, expectItem } from '../../../test/fixtures/items';

jest.mock('node-fetch');

// mock datasource
jest.mock('../../../../../plugins/datasource');
const testUtils = new ItemTestUtils();

const itemRepository = new ItemRepository();

const iframelyMeta = {
  title: 'title',
  description: 'description',
};

const iframelyResult = {
  meta: iframelyMeta,
  html: 'html',
  icons: [],
  thumbnails: [],
};

// TODO: test iframely

describe('Link Item tests', () => {
  let app: FastifyInstance;
  let actor: Actor;

  beforeEach(() => {
    (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { json: async () => iframelyResult } as any;
    });
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = undefined;
    app.close();
  });

  describe('POST /items', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const payload = LinkItemFactory();
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Create successfully', async () => {
        const payload = LinkItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items',
          payload,
        });

        const expectedItem = {
          name: iframelyMeta.title,
          type: ItemType.LINK,
          extra: {
            [ItemType.LINK]: {
              url: payload.extra.embeddedLink.url,
              html: 'html',
              icons: [],
              thumbnails: [],
            },
          },
          description: iframelyMeta.description,
          settings: {
            showLinkIframe: false,
            showLinkButton: true,
          },
        };

        // check response value
        const newItem = response.json();
        expect(response.statusCode).toBe(StatusCodes.OK);
        expectItem(newItem, expectedItem);

        // check item exists in db
        const item = await itemRepository.get(newItem.id);
        expectItem(item, expectedItem);

        // a membership is created for this item
        const membership = await ItemMembershipRepository.findOneBy({ item: { id: newItem.id } });
        expect(membership?.permission).toEqual(PermissionLevel.Admin);
      });

      it('Fail to create if type does not match extra', async () => {
        const payload = {
          type: ItemType.DOCUMENT,
          extra: {
            [ItemType.LINK]: {
              html: 'html',
              icons: [],
              thumbnails: [],
              url: 'https://myurl.com',
            },
          },
          name: 'mylink',
        };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items',
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Fail to create if payload is invalid', async () => {
        const payload = {
          type: ItemType.DOCUMENT,
          extra: { [ItemType.FOLDER]: { url: 'https://myurl.com' } },
          name: 'mylink',
        };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items',
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Fail to create if url of link is not an url', async () => {
        const payload1 = {
          type: ItemType.LINK,
          extra: { [ItemType.LINK]: { url: 'someurl' } },
          name: 'mylink',
        };

        const response1 = await app.inject({
          method: HttpMethod.Post,
          url: '/items',
          payload: payload1,
        });

        expect(response1.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  // cannot update a link
  describe('PATCH /items/:id', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Allow to edit link url', async () => {
        const { item } = await testUtils.saveItemAndMembership({
          item: {
            name: 'link item',
            type: ItemType.LINK,
          },
          member: actor,
        });
        const payload = {
          name: 'new name',
          extra: {
            [ItemType.LINK]: {
              url: 'https://newurl.com',
            },
          },
          settings: {
            someSetting: 'value',
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/${item.id}`,
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.OK);
        expect(response.statusCode).toBe(StatusCodes.OK);
        // TODO: check that the title and description have been updated for the new link
      });

      it('Disallow editing html in extra', async () => {
        const { item } = await testUtils.saveItemAndMembership({
          item: {
            name: 'link item',
            type: ItemType.LINK,
          },
          member: actor,
        });
        const payload = {
          name: 'new name',
          extra: {
            [ItemType.LINK]: {
              html: '<script>alert("Hello !")</script>',
            },
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/${item.id}`,
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  // cannot update a link
  describe('PATCH many /items', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items?id=${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Fail to update', async () => {
        const { item } = await testUtils.saveItemAndMembership({
          item: {
            type: ItemType.LINK,
            extra: {
              [ItemType.LINK]: {
                url: 'https://myurl.com',
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            name: 'mylink',
          },
          member: actor,
        });
        const payload = {
          name: 'new name',
          extra: {
            [ItemType.LINK]: {
              url: 'https://validurl.com',
            },
          },
          settings: {
            someSetting: 'value',
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items?id=${item.id}`,
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
