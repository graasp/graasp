import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';
import waitForExpect from 'wait-for-expect';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, MAX_TARGETS_FOR_MODIFY_REQUEST, PermissionLevel } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { MULTIPLE_ITEMS_LOADING_TIME } from '../../../../../test/constants';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { itemsRawTable, recycledItemDatasTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../../../utils/config';
import { assertIsMemberForTest } from '../../../authentication';
import { ITEMS_PAGE_SIZE } from '../../constants';
import { expectItem, expectManyItems } from '../../test/fixtures/items';

describe('Recycle Bin Tests', () => {
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

  describe('Endpoints', () => {
    describe('GET /recycled', () => {
      it('Throws if signed out', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/api/items/recycled',
        });

        expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });

      describe('Signed In', () => {
        it('Successfully get recycled items', async () => {
          const {
            actor,
            items: [item0, item1],
          } = await seedFromJson({
            items: [
              {
                isDeleted: true,
                creator: 'actor',
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
              {
                isDeleted: true,
                creator: 'actor',
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
              // noise
              { isDeleted: true },
            ],
          });
          assertIsDefined(actor);
          assertIsMemberForTest(actor);
          mockAuthenticate(actor);

          // we should not get item2
          const recycledItems = [item0, item1];

          const res = await app.inject({
            method: HttpMethod.Get,
            url: '/api/items/recycled',
          });

          const response = res.json();
          expect(res.statusCode).toBe(StatusCodes.OK);

          const dbDeletedItems = await db.query.itemsRawTable.findMany({
            where: eq(itemsRawTable.creatorId, actor.id),
          });
          expectManyItems(dbDeletedItems, recycledItems);
          // check response recycled items
          expectManyItems(response.data, recycledItems, actor);
          expect(response.pagination.page).toEqual(1);
          expect(response.pagination.pageSize).toEqual(ITEMS_PAGE_SIZE);
        });

        it('Successfully get second page with smaller page size', async () => {
          const { actor } = await seedFromJson({
            items: [
              {
                isDeleted: true,
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
              {
                isDeleted: true,
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
              {
                isDeleted: true,
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
              {
                isDeleted: true,
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
              {
                isDeleted: true,
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
              {
                isDeleted: true,
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
              // noise
              { isDeleted: true },
            ],
          });
          assertIsDefined(actor);
          assertIsMemberForTest(actor);
          mockAuthenticate(actor);

          const res = await app.inject({
            method: HttpMethod.Get,
            url: '/api/items/recycled',
            query: { page: '2', pageSize: '5' },
          });

          expect(res.statusCode).toBe(StatusCodes.OK);

          // receive last created item
          const response = res.json();
          expect(response.data).toHaveLength(1);
          expect(response.pagination.page).toEqual(2);
          expect(response.pagination.pageSize).toEqual(5);
        });

        it('Successfully return recycled subitems', async () => {
          const {
            actor,
            items: [item0, _parent, deletedChild],
          } = await seedFromJson({
            items: [
              {
                isDeleted: true,
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
              {
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
                children: [
                  {
                    isDeleted: true,
                  },
                ],
              },
              // noise
              { isDeleted: true },
            ],
          });
          assertIsDefined(actor);
          assertIsMemberForTest(actor);
          mockAuthenticate(actor);

          // we should not get item2
          const recycledItems = [item0, deletedChild];

          const res = await app.inject({
            method: HttpMethod.Get,
            url: '/api/items/recycled',
          });

          const response = res.json();
          expect(res.statusCode).toBe(StatusCodes.OK);

          // check response recycled item
          expectManyItems(response.data, recycledItems, actor);
          expect(response.pagination.page).toEqual(1);
          expect(response.pagination.pageSize).toEqual(ITEMS_PAGE_SIZE);
        });

        it('Does not return child of recycled item', async () => {
          const { actor } = await seedFromJson({
            items: [
              {
                isDeleted: true,
                memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
                children: [
                  {
                    memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
                  },
                ],
              },
              // noise
              { isDeleted: true },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const res = await app.inject({
            method: HttpMethod.Get,
            url: '/api/items/recycled',
          });

          const response = res.json();
          expect(res.statusCode).toBe(StatusCodes.OK);

          // should not return child item for actor
          // does not return parent because actor has read permissio
          expect(res.json().data).toHaveLength(0);
          expect(response.pagination.page).toEqual(1);
          expect(response.pagination.pageSize).toEqual(ITEMS_PAGE_SIZE);
        });
      });
    });

    describe('POST /recycle', () => {
      it('Throws if signed out', async () => {
        const {
          items: [item],
        } = await seedFromJson({
          actor: null,
          items: [
            {},
            // noise
            { isDeleted: true },
          ],
        });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/recycle?id=${item.id}`,
        });

        expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });

      describe('Signed In', () => {
        it('Successfully recycle many items', async () => {
          const { actor, items } = await seedFromJson({
            items: [
              {
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
              {
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
              {
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const itemIds = items.map((i) => i.id);
          const res = await app.inject({
            method: HttpMethod.Post,
            url: '/api/items/recycle',
            query: { id: itemIds },
          });
          expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

          await new Promise((res) => {
            setTimeout(async () => {
              // check items are soft deleted
              const saved = await db.query.itemsRawTable.findMany({
                where: and(isNotNull(itemsRawTable.deletedAt), inArray(itemsRawTable.id, itemIds)),
              });
              expectManyItems(saved, items);

              // check recycle item entries
              const savedEntries = await db.query.recycledItemDatasTable.findMany({
                where: inArray(
                  recycledItemDatasTable.itemPath,
                  items.map(({ path }) => path),
                ),
              });
              expect(savedEntries).toHaveLength(items.length);

              res(true);
            }, MULTIPLE_ITEMS_LOADING_TIME);
          });
        });

        it('Returns error in array if does not have rights on one item', async () => {
          const { actor, items } = await seedFromJson({
            items: [
              {},
              {
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
              {
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const itemIds = items.map((i) => i.id);
          const res = await app.inject({
            method: HttpMethod.Post,
            url: '/api/items/recycle',
            query: { id: itemIds },
          });

          expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

          await new Promise((res) => {
            setTimeout(async () => {
              // check items are NOT soft deleted
              const savedNotDeleted = await db.query.itemsRawTable.findMany({
                where: and(isNull(itemsRawTable.deletedAt), inArray(itemsRawTable.id, itemIds)),
              });
              expect(savedNotDeleted).toHaveLength(items.length);

              // check NO recycle item entries
              const savedEntries = await db.query.recycledItemDatasTable.findMany({
                where: inArray(
                  recycledItemDatasTable.itemPath,
                  items.map(({ path }) => path),
                ),
              });
              expect(savedEntries).toHaveLength(0);

              res(true);
            }, MULTIPLE_ITEMS_LOADING_TIME);
          });
        });

        it('Bad request if recycle more than maxItemsInRequest items', async () => {
          const { actor, items } = await seedFromJson({
            items: Array.from({ length: MAX_TARGETS_FOR_MODIFY_REQUEST + 1 }, () => ({
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            })),
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const res = await app.inject({
            method: HttpMethod.Post,
            url: '/api/items/recycle',
            query: { id: items.map(({ id }) => id) },
          });
          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });

        it('Bad request for invalid id', async () => {
          const { actor } = await seedFromJson();
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const res = await app.inject({
            method: HttpMethod.Post,
            url: '/api/items/recycle',
            query: { id: ['invalid-id', v4()] },
          });

          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });
      });
    });

    describe('POST /restore', () => {
      it('Throws if signed out', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/restore?id=${v4()}`,
        });

        expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });

      describe('Signed In', () => {
        it('Successfully restore multiple items', async () => {
          const { actor, items } = await seedFromJson({
            items: [
              {
                isDeleted: true,
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
              {
                isDeleted: true,
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const itemIds = items.map((i) => i.id);
          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/restore`,
            query: { id: itemIds },
          });

          expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
          await waitForExpect(async () => {
            expect(
              await db.query.itemsRawTable.findMany({
                where: and(isNull(itemsRawTable.deletedAt), inArray(itemsRawTable.id, itemIds)),
              }),
            ).toHaveLength(items.length);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });

        it('Bad request for invalid id', async () => {
          const { actor } = await seedFromJson();
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const res = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/restore`,
            query: { id: ['invalid-id', v4()] },
          });

          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });

        it('Bad request if submit same id', async () => {
          const { actor } = await seedFromJson();
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const sameId = v4();
          const res = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/restore`,
            query: { id: [sameId, sameId] },
          });

          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });

        it('Bad request if submit too many ids', async () => {
          const { actor } = await seedFromJson();
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const res = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/restore`,
            query: { id: Array.from({ length: MAX_TARGETS_FOR_MODIFY_REQUEST + 1 }, () => v4()) },
          });

          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });

        it('Throws if one item does not exist', async () => {
          const { actor, items } = await seedFromJson({
            items: [
              {
                isDeleted: true,
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
              {
                isDeleted: true,
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const itemIds = items.map((i) => i.id);
          const res = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/restore`,
            query: { id: [...itemIds, v4()] },
          });
          expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

          // did not restore any items
          await waitForExpect(async () => {
            expect(
              await db.query.itemsRawTable.findMany({
                where: and(isNotNull(itemsRawTable.deletedAt), inArray(itemsRawTable.id, itemIds)),
              }),
            ).toHaveLength(items.length);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });

        it('Throws if has no admin rights on one item', async () => {
          const { actor, items } = await seedFromJson({
            items: [
              {
                isDeleted: true,
              },
              {
                isDeleted: true,
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const itemIds = items.map((i) => i.id);
          const res = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/restore`,
            query: { id: itemIds },
          });
          expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

          // did not restore any items
          await waitForExpect(async () => {
            expect(
              await db.query.itemsRawTable.findMany({
                where: and(isNotNull(itemsRawTable.deletedAt), inArray(itemsRawTable.id, itemIds)),
              }),
            ).toHaveLength(items.length);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
    });
  });

  describe('Scenarios', () => {
    /**
     * This is a regression test from a real production bug caused by not restoring the soft-deleted children
     */
    it('Restores the subtree successfully if it has children', async () => {
      const {
        actor,
        items: [parentItem, childItem],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            children: [{}],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const recycle = await app.inject({
        method: HttpMethod.Post,
        url: `/items/recycle?id=${parentItem.id}`,
      });
      expect(recycle.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(
          await db.query.recycledItemDatasTable.findMany({
            where: eq(recycledItemDatasTable.itemPath, parentItem.path),
          }),
        ).toHaveLength(1);
        expect(
          await db.query.itemsRawTable.findMany({
            where: and(isNotNull(itemsRawTable.deletedAt), eq(itemsRawTable.id, childItem.id)),
          }),
        ).toHaveLength(1);
      });

      const restore = await app.inject({
        method: HttpMethod.Post,
        url: `/items/restore?id=${parentItem.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(
          await db.query.recycledItemDatasTable.findMany({
            where: eq(recycledItemDatasTable.itemPath, parentItem.path),
          }),
        ).toHaveLength(0);
      });

      const restoredChild = await db.query.itemsRawTable.findFirst({
        where: and(eq(itemsRawTable.id, childItem.id), isNull(itemsRawTable.deletedAt)),
      });
      // the recycle/restore operation changed the updatedAt value, but we can't know when from the outside
      expectItem(restoredChild, childItem);
    });
  });
});
