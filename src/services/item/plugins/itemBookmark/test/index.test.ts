import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../test/app';
import { seedFromJson } from '../../../../../../test/mocks/seed';
import { db } from '../../../../../drizzle/db';
import { itemBookmarks } from '../../../../../drizzle/schema';
import { assertIsDefined } from '../../../../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { PermissionLevel } from '../../../../itemMembership/types';

describe('Bookmarks', () => {
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

  describe('GET /bookmarks', () => {
    describe('Signed in', () => {
      it('Get favorite', async () => {
        const {
          actor,
          members: [member],
          bookmarks: [bookmark],
        } = await seedFromJson({ items: [{ creator: { name: 'bob' }, isBookmarked: true }] });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/bookmarks`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);

        expect(res.json()[0]).toMatchObject(
          expect.objectContaining({
            item: expect.objectContaining({
              id: bookmark.itemId,
              creator: expect.objectContaining({ id: member.id }),
            }),
          }),
        );
      });

      it('Get favorite with trashed favorite item', async () => {
        const { actor } = await seedFromJson({ items: [{ isDeleted: true, isBookmarked: true }] });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/bookmarks`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toStrictEqual([]);
      });
    });
  });

  describe('POST /bookmark/:id', () => {
    describe('Signed out', () => {
      it('Throws', async () => {
        const {
          items: [item],
        } = await seedFromJson({ actor: null, items: [{}] });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/bookmarks/${item.id}`,
        });
        expect(res.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed in', () => {
      it('Post a new favorite', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Read }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/bookmarks/${item.id}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);

        const favorites = await db.query.itemBookmarks.findMany({
          where: eq(itemBookmarks.memberId, actor.id),
        });

        expect(favorites).toHaveLength(1);
        expect(favorites[0]).toMatchObject({ itemId: item.id });
      });

      it('Post the same favorite throws', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Read }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        // Add the favorite the first time
        await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/bookmarks/${item.id}`,
        });

        // Add the same favorite a second time
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/bookmarks/${item.id}`,
        });
        expect(res.statusCode).toBe(StatusCodes.CONFLICT); // Assuming the POST endpoint returns 409 CONFLICT on duplicate
      });

      it('Bad request if id is invalid', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const invalidId = '123456-invalid';

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/bookmarks/${invalidId}`,
        });

        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
    describe('DELETE /bookmark/:id', () => {
      describe('Signed out', () => {
        it('Throws if not authenticated', async () => {
          const {
            items: [item],
          } = await seedFromJson({ actor: null, items: [{}] });

          const res = await app.inject({
            method: HttpMethod.Delete,
            url: `${ITEMS_ROUTE_PREFIX}/bookmarks/${item.id}`,
          });

          expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
        });
      });

      describe('Signed in', () => {
        it('Delete removes favorite', async () => {
          const {
            actor,
            items: [item],
          } = await seedFromJson({
            items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Read }] }],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const res = await app.inject({
            method: HttpMethod.Delete,
            url: `${ITEMS_ROUTE_PREFIX}/bookmarks/${item.id}`,
          });

          expect(res.statusCode).toBe(StatusCodes.OK);

          const favorites = await db.query.itemBookmarks.findMany({
            where: eq(itemBookmarks.memberId, actor.id),
          });
          expect(favorites).toHaveLength(0);
        });
      });
    });
  });
});
