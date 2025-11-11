import { StatusCodes } from 'http-status-codes';

import type { FastifyInstance } from 'fastify';

import { DocumentItemExtraFlavor, HttpMethod, ItemType } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { assertIsDefined } from '../../../../utils/assertions';
import { assertIsMemberForTest } from '../../../authentication';

describe('Document Item tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  describe('POST /items/documents', () => {
    it('Throws if signed out', async () => {
      const payload = { name: 'name', content: 'content' };

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/documents',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Throws if actor is guest', async () => {
      const {
        guests: [guest],
      } = await seedFromJson({ actor: null, items: [{ itemLoginSchema: { guests: [{}] } }] });
      mockAuthenticate(guest);

      const payload = { name: 'name', content: 'content' };
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/documents',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('Throws if actor is not validated', async () => {
      const { actor } = await seedFromJson({ actor: { isValidated: false } });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const payload = { name: 'name', content: 'content' };
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/documents',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('Throws if content is empty', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const payload = { name: 'name', content: '' };
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/documents',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('Throws if isRaw is invalid', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const payload = { name: 'name', content: 'content', isRaw: 'value' };
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/documents',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('Throws if flavor is invalid', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const payload = { name: 'name', content: 'content', flavor: 'value' };
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/documents',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    describe('Signed In', () => {
      it('Create successfully', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/documents',
          payload: { name: 'name', content: 'content' },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
      });
    });
  });

  describe('PATCH /items/documents/:id', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{ type: ItemType.DOCUMENT }] });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/documents/${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Throws if actor is guest', async () => {
      const {
        items: [item],
        guests: [guest],
      } = await seedFromJson({
        items: [{ type: ItemType.DOCUMENT, itemLoginSchema: { guests: [{}] } }],
      });
      mockAuthenticate(guest);

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/documents/${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('Throws if actor is not validated', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        actor: { isValidated: false },
        items: [{ type: ItemType.DOCUMENT }],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/documents/${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('Throws if content is empty', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ type: ItemType.DOCUMENT }],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const payload = { name: 'name', content: '' };
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/documents/${item.id}`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('Throws if isRaw is invalid', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ type: ItemType.DOCUMENT }],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const payload = { name: 'name', content: 'content', isRaw: 'value' };
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/documents/${item.id}`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('Throws if flavor is invalid', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ type: ItemType.DOCUMENT }],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const payload = { name: 'name', content: 'content', flavor: 'value' };
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/documents/${item.id}`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    describe('Signed In', () => {
      it('Update successfully', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor' }],
              type: ItemType.DOCUMENT,
              extra: {
                [ItemType.DOCUMENT]: {
                  content: 'value',
                },
              },
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
          content: 'new value',
          // test that flavor can be updated
          flavor: DocumentItemExtraFlavor.Info,

          settings: {
            hasThumbnail: true,
            isCollapsible: true,
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/documents/${item.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
      });
    });
  });
});
