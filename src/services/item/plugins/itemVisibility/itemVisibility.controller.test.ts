import { and, eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, ItemVisibilityType } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { itemVisibilitiesTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../../../utils/config';
import { CannotModifyParentVisibility, ConflictingVisibilitiesInTheHierarchy } from './errors';

export const saveTagsForItem = async ({ item, creator }) => {
  const res = await db
    .insert(itemVisibilitiesTable)
    .values({ itemPath: item.path, creatorId: creator.id, type: ItemVisibilityType.Hidden })
    .returning();

  return res;
};

describe('Item Visibility', () => {
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

  describe('POST /:itemId/visibilities', () => {
    describe('Signed Out', () => {
      it('Throws if item is private', async () => {
        const {
          items: [item],
        } = await seedFromJson({ actor: null, items: [{}] });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/visibilities/${ItemVisibilityType.Hidden}`,
        });

        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed In', () => {
      it('Create a visibility for an item', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({ items: [{ memberships: [{ account: 'actor' }] }] });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/visibilities/${ItemVisibilityType.Hidden}`,
        });
        expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);
        const savedValue = await db.query.itemVisibilitiesTable.findFirst({
          where: and(
            eq(itemVisibilitiesTable.itemPath, item.path),
            eq(itemVisibilitiesTable.type, ItemVisibilityType.Hidden),
          ),
        });
        expect(savedValue).toBeDefined();
      });

      it('Cannot create visibility if exists for item', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{ isHidden: true, memberships: [{ account: 'actor' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/visibilities/${ItemVisibilityType.Hidden}`,
        });
        expect(res.json()).toMatchObject(
          new ConflictingVisibilitiesInTheHierarchy(expect.anything()),
        );
      });

      it('Cannot create visibility if exists on parent', async () => {
        const {
          actor,
          items: [_parentItem, child],
        } = await seedFromJson({
          items: [{ isHidden: true, memberships: [{ account: 'actor' }], children: [{}] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${child.id}/visibilities/${ItemVisibilityType.Hidden}`,
        });
        expect(res.json()).toMatchObject(
          new ConflictingVisibilitiesInTheHierarchy(expect.anything()),
        );
      });

      it('Bad request if item id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/visibilities/${ItemVisibilityType.Hidden}`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Bad request if type is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/visibilities/invalid-type`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if type is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/visibilities/invalid-type`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });

    describe('DELETE /:itemId/visibilities/:id', () => {
      describe('Signed Out', () => {
        it('Throws if item is private', async () => {
          const {
            items: [item],
          } = await seedFromJson({ actor: null, items: [{}] });

          const response = await app.inject({
            method: HttpMethod.Delete,
            url: `${ITEMS_ROUTE_PREFIX}/${item.id}/visibilities/${ItemVisibilityType.Public}`,
          });

          expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
        });
      });

      describe('Signed In', () => {
        it('Delete a visibility of an item (and descendants)', async () => {
          const {
            actor,
            items: [parentItem],
            itemVisibilities: [parentPublicVisibility, childPublicVisibility],
          } = await seedFromJson({
            items: [
              {
                isPublic: true,
                memberships: [{ account: 'actor' }],
                children: [{ isPublic: true }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const res = await app.inject({
            method: HttpMethod.Delete,
            url: `${ITEMS_ROUTE_PREFIX}/${parentItem.id}/visibilities/${ItemVisibilityType.Public}`,
          });

          expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);
          const itemVisibility = await db.query.itemVisibilitiesTable.findFirst({
            where: eq(itemVisibilitiesTable.id, parentPublicVisibility.id),
          });
          expect(itemVisibility).toBeUndefined();
          const childItemTag = await db.query.itemVisibilitiesTable.findFirst({
            where: eq(itemVisibilitiesTable.id, childPublicVisibility.id),
          });
          expect(childItemTag).toBeUndefined();
        });
        it('Cannot delete inherited visibility', async () => {
          const {
            actor,
            items: [_parentItem, child],
          } = await seedFromJson({
            items: [
              {
                isPublic: true,
                memberships: [{ account: 'actor' }],
                children: [{}],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const res = await app.inject({
            method: HttpMethod.Delete,
            url: `${ITEMS_ROUTE_PREFIX}/${child.id}/visibilities/${ItemVisibilityType.Public}`,
          });
          expect(res.json()).toMatchObject(new CannotModifyParentVisibility(expect.anything()));
        });
        it('Does not throw if visibility does not exist', async () => {
          const {
            actor,
            items: [item],
          } = await seedFromJson({
            items: [
              {
                memberships: [{ account: 'actor' }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const res = await app.inject({
            method: HttpMethod.Delete,
            url: `${ITEMS_ROUTE_PREFIX}/${item.id}/visibilities/${ItemVisibilityType.Hidden}`,
          });
          expect(res.statusCode).toEqual(StatusCodes.NO_CONTENT);
        });
        it('Bad request if item id is invalid', async () => {
          const res = await app.inject({
            method: HttpMethod.Delete,
            url: `${ITEMS_ROUTE_PREFIX}/invalid-id/visibilities/${ItemVisibilityType.Hidden}`,
          });
          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });
        it('Bad request if item visibility id is invalid', async () => {
          const res = await app.inject({
            method: HttpMethod.Delete,
            url: `${ITEMS_ROUTE_PREFIX}/${v4()}/visibilities/invalid-id`,
          });
          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });
      });
    });
  });
});
