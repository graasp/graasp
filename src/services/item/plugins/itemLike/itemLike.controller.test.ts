import { isAfter } from 'date-fns';
import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, PermissionLevel } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { itemLikesTable } from '../../../../drizzle/schema';
import type { ItemLikeRaw } from '../../../../drizzle/types';
import type { MinimalMember } from '../../../../types';
import { assertIsDefined } from '../../../../utils/assertions';
import { MemberCannotAccess } from '../../../../utils/errors';
import { assertIsMember } from '../../../authentication';
import { ItemWrapper, type PackedItem } from '../../ItemWrapper';
import { expectManyPackedItems } from '../../test/fixtures/items';
import { ItemLikeNotFound } from './utils/errors';

export const expectItemLike = (
  newLike: ItemLikeRaw | undefined,
  correctLike: ItemLikeRaw,
  creator?: MinimalMember,
) => {
  expect(newLike?.itemId).toEqual(correctLike.itemId);

  if (newLike?.creatorId && creator) {
    expect(newLike?.creatorId).toEqual(creator.id);
  }
};

export const expectManyItemLikes = (
  newLikes: ItemLikeRaw[],
  correctLikes: ItemLikeRaw[],
  creator?: MinimalMember,
) => {
  expect(newLikes).toHaveLength(correctLikes.length);
  newLikes.forEach((l) => {
    const like = correctLikes.find(({ id }) => id === l.id);
    if (!like) {
      throw new Error('Cannot find like for test');
    }
    expectItemLike(l, like, creator);
  });
};

const getFullItemLike = (id: string) => {
  return db.query.itemLikesTable.findFirst({ where: eq(itemLikesTable.id, id) });
};

const getItemLikesByItem = (itemId: string) => {
  return db.query.itemLikesTable.findMany({ where: eq(itemLikesTable.itemId, itemId) });
};

describe('Item Like', () => {
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

  describe('GET /liked', () => {
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/api/items/liked',
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Get item likes of a user', async () => {
        const { actor, items } = await seedFromJson({
          items: [{ likes: ['actor'] }, { likes: ['actor'] }],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: '/api/items/liked',
        });
        expect(res.statusCode).toBe(StatusCodes.OK);

        // check returned items
        expectManyPackedItems(
          res.json<{ item: PackedItem }[]>().map(({ item }) => item),
          items.map((i) => new ItemWrapper({ ...i, creator: null }).packed()),
          actor,
        );
      });

      it('Get item likes of a user without trashed items', async () => {
        const { actor, items } = await seedFromJson({
          items: [{ likes: ['actor'], isDeleted: true }, { likes: ['actor'] }],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: '/api/items/liked',
        });

        expect(res.statusCode).toBe(StatusCodes.OK);

        // check returned items
        expectManyPackedItems(
          res.json().map(({ item }) => item),
          items.map((i) => new ItemWrapper({ ...i, creator: null }).packed()),
          actor,
        );
      });
    });
  });

  describe('GET /:itemId/likes', () => {
    describe('Signed Out', () => {
      it('Throws if signed out', async () => {
        const {
          items: [item],
        } = await seedFromJson({
          items: [{}],
          actor: null,
        });
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}/likes`,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });
    });

    describe('Public', () => {
      it('Get like entries for public item', async () => {
        const {
          items: [item],
          likes,
        } = await seedFromJson({
          items: [{ likes: ['actor'], isPublic: true }],
        });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}/likes`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        // get item like from repository with item (not returned in request)
        const fullItemLike = await getFullItemLike(res.json()[0].id);
        expectItemLike(fullItemLike, likes[0]);
      });

      it('Get like entries for public item in the trash', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{ likes: ['actor'], isPublic: true, isDeleted: true }],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}/likes`,
        });
        expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
      });
    });

    describe('Signed In', () => {
      it('Get like entries for item', async () => {
        const {
          actor,
          items: [item1],
          likes: [like],
        } = await seedFromJson({
          items: [
            {
              likes: ['actor'],
              memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
            },
            {
              likes: ['actor'],
              memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item1.id}/likes`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        // get item like from repository with item (not returned in request)
        const fullItemLike = await getFullItemLike(res.json()[0].id);
        expectItemLike(fullItemLike, like);
      });

      it('Cannot get like item if does not have rights', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{ likes: ['actor'] }],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}/likes`,
        });
        expect(res.json()).toEqual(new MemberCannotAccess(item.id));
      });

      it('Get like entries for public item', async () => {
        const {
          actor,
          items: [item],
          likes,
        } = await seedFromJson({
          items: [
            {
              likes: ['actor'],
              isPublic: true,
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}/likes`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);

        // get item like from repository with item (not returned in request)
        const fullItemLike = await getFullItemLike(res.json()[0].id);
        expectItemLike(fullItemLike, likes[0]);
      });
    });

    it('Bad request if id is invalid', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMember(actor);
      mockAuthenticate(actor);

      const res = await app.inject({
        method: HttpMethod.Get,
        url: '/api/items/invalid-id/likes',
      });
      expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  describe('POST /:itemId/like', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${item.id}/like`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Create like record', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              likes: [{ name: 'bob' }],
              memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `/items/${item.id}/like`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);

        // check received item like
        // since we don't have full item, deduce from saved value
        const savedLikes = await getItemLikesByItem(item.id);
        expect(savedLikes).toHaveLength(2);
        expect(savedLikes[1].creatorId).toEqual(actor.id);
      });

      it('Allows to override like if already exist', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              likes: ['actor'],
              memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);
        const [initialLike] = await getItemLikesByItem(item.id);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `/items/${item.id}/like`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        // the creatorId should be the same
        const result = await res.json();
        expect(result.creatorId).toEqual(actor.id);

        // check received item like
        // since we don't have full item, deduce from saved value
        const savedLikes = await getItemLikesByItem(item.id);
        expect(savedLikes).toHaveLength(1);
        expect(savedLikes[0].creatorId).toEqual(actor.id);
        expect(isAfter(savedLikes[0].createdAt, initialLike.createdAt)).toBeTruthy();
      });

      it('Cannot like item if does not have rights', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{}],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `/items/${item.id}/like`,
        });
        expect(res.json()).toEqual(new MemberCannotAccess(item.id));
      });

      it('Bad request if id is invalid', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/invalid-id/like',
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('DELETE :itemId/like', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/items/${item.id}/like`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Delete item like', async () => {
        const {
          actor,
          items: [item],
          likes: [itemLike],
        } = await seedFromJson({
          items: [
            {
              likes: ['actor'],
              memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `/items/${item.id}/like`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.body).toEqual(itemLike.id);
      });

      it('Cannot dislike if have no rights on item', async () => {
        const {
          actor,
          items: [item],
          likes: [itemLike],
        } = await seedFromJson({
          items: [
            {
              likes: ['actor'],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `/items/${item.id}/like`,
        });
        expect(res.json()).toEqual(new MemberCannotAccess(item.id));

        // check item like still exists in db
        const savedItemLike = await getFullItemLike(itemLike.id);
        expect(savedItemLike).toBeTruthy();
      });

      it('Cannot delete item like if did not like', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `/items/${item.id}/like`,
        });
        expect(res.json()).toEqual(new ItemLikeNotFound({ creatorId: actor.id, itemId: item.id }));
      });

      it('Bad request if item id is invalid', async () => {
        const { actor } = await seedFromJson({
          items: [{}],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: '/api/items/invalid-id/like',
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
