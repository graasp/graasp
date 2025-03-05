import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import fetch from 'node-fetch';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType, LinkItemFactory, PermissionLevel } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../test/app';
import { ItemFactory } from '../../../../../../test/factories/item.factory';
import { seedFromJson } from '../../../../../../test/mocks/seed';
import { ItemRepository } from '../../../repository';
import { expectItem } from '../../../test/fixtures/items';

jest.mock('node-fetch');

const itemRepository = new ItemRepository();
const itemMembershipRawRepository = AppDataSource.getRepository(ItemMembership);

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

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  beforeEach(() => {
    (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { json: async () => iframelyResult } as any;
    });
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  describe('POST /items', () => {
    it('Throws if signed out', async () => {
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
        const { actor } = await seedFromJson();
        mockAuthenticate(actor);
      });

      it('Create successfully', async () => {
        const payload = LinkItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items',
          payload,
        });

        const expectedItem = {
          name: payload.name,
          type: ItemType.LINK,
          extra: {
            [ItemType.LINK]: {
              url: payload.extra.embeddedLink.url,
              html: 'html',
              icons: [],
              thumbnails: [],
              description: iframelyMeta.description,
            },
          },
          description: payload.description,
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
        const item = await itemRepository.getOne(newItem.id);
        expectItem(item, expectedItem);

        // a membership is created for this item
        const membership = await itemMembershipRawRepository.findOneBy({
          item: { id: newItem.id },
        });
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
      const {
        items: [item],
      } = await seedFromJson({ items: [ItemFactory({ type: ItemType.LINK })] });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Allow to edit link url', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              ...ItemFactory({ name: 'link item', type: ItemType.LINK }),
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        mockAuthenticate(actor);

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
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [ItemFactory({ name: 'link item', type: ItemType.LINK })],
        });
        mockAuthenticate(actor);

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
});
