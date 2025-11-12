import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, PermissionLevel, TagCategory } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { assertIsDefined } from '../../../../utils/assertions';

// tag are global in whole database and can collide
jest.retryTimes(3, { logErrorsBeforeRetry: true });

describe('Item Tag Endpoints', () => {
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

  describe('GET /:itemId/tags', () => {
    it('Throw for invalid item id', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/items/invalid/tags`,
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    describe('Signed out', () => {
      it('Return tags for public item', async () => {
        const {
          items: [item],
          tags,
        } = await seedFromJson({
          items: [
            {
              isPublic: true,
              tags: [{ name: faker.word.sample(), category: TagCategory.Discipline }],
            },
          ],
        });

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${item.id}/tags`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json()).toEqual(expect.arrayContaining(tags));
      });

      it('Throws for private item', async () => {
        const {
          items: [item],
        } = await seedFromJson({
          items: [
            {
              tags: [{ name: faker.word.sample(), category: TagCategory.Discipline }],
            },
          ],
        });

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${item.id}/tags`,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });

    describe('Signed In', () => {
      it('Return tags for private item', async () => {
        const {
          items: [item],
          tags,
          actor,
        } = await seedFromJson({
          items: [
            {
              isPublic: true,
              tags: [{ name: faker.word.sample(), category: TagCategory.Discipline }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${item.id}/tags`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json()).toEqual(expect.arrayContaining(tags));
      });

      it('Return no tag', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${item.id}/tags`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json()).toHaveLength(0);
      });

      it('Throw if does not have access to item', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [{}],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${item.id}/tags`,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });

  describe('POST /:itemId/tags', () => {
    it('Throw for invalid item id', async () => {
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/invalid/tags`,
        payload: { name: 'name', category: TagCategory.Discipline },
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    describe('Signed out', () => {
      it('Cannot add tag', async () => {
        const {
          items: [item],
        } = await seedFromJson({ actor: null, items: [{}] });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/${item.id}/tags`,
          payload: { name: 'name', category: TagCategory.Discipline },
        });
        expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed In', () => {
      it('Add tag for private item', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor' }],
              tags: [{ name: faker.word.sample(), category: TagCategory.Discipline }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/${item.id}/tags`,
          payload: { name: 'name', category: TagCategory.Discipline },
        });

        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      });

      it('Cannot add tag with wrong category', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor' }],
              tags: [{ name: faker.word.sample(), category: TagCategory.Discipline }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/${item.id}/tags`,
          payload: { name: 'name', category: 'wrong' },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throw if does not have access to item', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              tags: [{ name: faker.word.sample(), category: TagCategory.Discipline }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/${item.id}/tags`,
          payload: { name: 'name', category: TagCategory.Discipline },
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });
  describe('DELETE /:itemId/tags/:tagId', () => {
    describe('Input schema validation', () => {
      it('Throw for invalid item id', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/api/items/invalid/tags/${v4()}`,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Throw for invalid tag id', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/api/items/${v4()}/tags/invalid}`,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });

    describe('Signed out', () => {
      it('Throw if signed out', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/api/items/${v4()}/tags/${v4()}`,
        });
        expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed In', () => {
      it('Delete tag for private item', async () => {
        const {
          items: [item],
          actor,
          tags: [tag],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor' }],
              tags: [{ name: faker.word.sample(), category: TagCategory.Discipline }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/api/items/${item.id}/tags/${tag.id}`,
        });

        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      });

      it('Cannot delete tag for item with write access', async () => {
        const {
          items: [item],
          actor,
          tags: [tag],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
              tags: [{ name: faker.word.sample(), category: TagCategory.Discipline }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/api/items/${item.id}/tags/${tag.id}`,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });
});
