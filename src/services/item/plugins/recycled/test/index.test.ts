import { StatusCodes } from 'http-status-codes';
import { In } from 'typeorm';
import { v4 } from 'uuid';
import waitForExpect from 'wait-for-expect';

import { FastifyInstance } from 'fastify';

import {
  FolderItemFactory,
  HttpMethod,
  MAX_TARGETS_FOR_MODIFY_REQUEST,
  MAX_TARGETS_FOR_READ_REQUEST,
  PermissionLevel,
} from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { MULTIPLE_ITEMS_LOADING_TIME } from '../../../../../../test/constants';
import { AppDataSource } from '../../../../../plugins/datasource';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { saveMember } from '../../../../member/test/fixtures/members';
import { Item } from '../../../entities/Item';
import { ItemTestUtils, expectItem, expectManyItems } from '../../../test/fixtures/items';
import { RecycledItemData } from '../RecycledItemData';
import { expectManyPackedRecycledItems, expectManyRecycledItems } from './fixtures';

const recycledItemDataRawRepository = AppDataSource.getRepository(RecycledItemData);
const testUtils = new ItemTestUtils();

describe('Recycle Bin Tests', () => {
  let app: FastifyInstance;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('Endpoints', () => {
    describe('GET /recycled', () => {
      it('Throws if signed out', async () => {
        ({ app } = await build({ member: null }));

        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/items/recycled',
        });

        expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });

      describe('Signed In', () => {
        beforeEach(async () => {
          ({ app, actor } = await build());
        });

        it('Successfully get recycled items', async () => {
          const { item: item0, packedItem: packedItem0 } = await testUtils.saveRecycledItem(actor);
          const { item: item1, packedItem: packedItem1 } = await testUtils.saveRecycledItem(actor);

          // actor does not have access
          const member = await saveMember();
          await testUtils.saveRecycledItem(member);

          // we should not get item2
          const recycledItems = [item0, item1];
          const recycledPackedItems = [packedItem0, packedItem1];

          const res = await app.inject({
            method: HttpMethod.Get,
            url: '/items/recycled',
          });

          const response = res.json();
          expect(res.statusCode).toBe(StatusCodes.OK);

          const dbDeletedItems = await testUtils.rawItemRepository.find({
            where: { creator: { id: actor.id } },
            withDeleted: true,
          });
          expect(response).toHaveLength(recycledItems.length);
          expectManyItems(dbDeletedItems, recycledItems);
          // check response recycled item
          expectManyPackedRecycledItems(response, recycledPackedItems, actor);
        });

        it('Successfully get subitems recycled items', async () => {
          const { item: item0, packedItem: packedItem0 } = await testUtils.saveRecycledItem(actor);
          const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
          const { item: deletedChild, packedItem: packedDeletedChild } =
            await testUtils.saveItemAndMembership({
              item: { name: 'child' },
              parentItem,
              member: actor,
            });
          await testUtils.saveRecycledItem(actor, deletedChild);

          // actor does not have access
          const member = await saveMember();
          await testUtils.saveRecycledItem(member);

          // we should not get item2
          const recycledItems = [item0, deletedChild];
          const recycledPackedItems = [packedItem0, packedDeletedChild];

          const res = await app.inject({
            method: HttpMethod.Get,
            url: '/items/recycled',
          });

          const response = res.json();
          expect(res.statusCode).toBe(StatusCodes.OK);

          expect(response).toHaveLength(recycledItems.length);
          const dbDeletedItems = response.map(({ item }) => item);
          expectManyItems(dbDeletedItems, recycledItems);
          // check response recycled item
          expectManyPackedRecycledItems(response, recycledPackedItems, actor);
        });
      });
    });

    describe('POST /recycle', () => {
      it('Throws if signed out', async () => {
        ({ app } = await build({ member: null }));
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/recycle?id=${item.id}`,
        });

        expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });

      describe('Signed In', () => {
        let items;
        let itemIds;
        beforeEach(async () => {
          ({ app, actor } = await build());
          const { item: item1 } = await testUtils.saveItemAndMembership({ member: actor });
          const { item: item2 } = await testUtils.saveItemAndMembership({ member: actor });
          const { item: item3 } = await testUtils.saveItemAndMembership({ member: actor });
          items = [item1, item2, item3];
          itemIds = items.map(({ id }) => id);
        });

        it('Successfully recycle many items', async () => {
          const res = await app.inject({
            method: HttpMethod.Post,
            url: '/items/recycle',
            query: { id: itemIds },
          });
          expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

          await new Promise((res) => {
            setTimeout(async () => {
              // check items are soft deleted
              const saved = await testUtils.rawItemRepository.find({
                withDeleted: true,
                where: { id: In(itemIds) },
              });
              expectManyItems(saved, items);
              const savedNotDeleted = await testUtils.rawItemRepository.find({
                where: { id: In(itemIds) },
              });
              expect(savedNotDeleted).toHaveLength(0);

              // check recycle item entries
              const savedEntries = await recycledItemDataRawRepository.find({
                where: { item: { path: In(items.map(({ path }) => path)) } },
              });
              expectManyRecycledItems(savedEntries, saved);
              res(true);
            }, MULTIPLE_ITEMS_LOADING_TIME);
          });
        });

        it('Returns error in array if does not have rights on one item', async () => {
          const member = await saveMember();
          const { item: errorItem } = await testUtils.saveRecycledItem(member);
          const res = await app.inject({
            method: HttpMethod.Post,
            url: '/items/recycle',
            query: { id: [...items.map(({ id }) => id), errorItem.id] },
          });

          expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

          await new Promise((res) => {
            setTimeout(async () => {
              // check items are NOT soft deleted
              const savedNotDeleted = await testUtils.rawItemRepository.find({
                where: { id: In(itemIds) },
              });
              expect(savedNotDeleted).toHaveLength(items.length);

              // check NO recycle item entries
              const savedEntries = await recycledItemDataRawRepository.find({
                where: { item: { path: In(items.map(({ path }) => path)) } },
              });
              expect(savedEntries).toHaveLength(0);

              res(true);
            }, MULTIPLE_ITEMS_LOADING_TIME);
          });
        });

        it('Bad request if recycle more than maxItemsInRequest items', async () => {
          const items = Array.from({ length: MAX_TARGETS_FOR_READ_REQUEST + 1 }, () =>
            FolderItemFactory(),
          );

          const res = await app.inject({
            method: HttpMethod.Post,
            url: '/items/recycle',
            query: { id: items.map(({ id }) => id) },
          });
          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });

        it('Bad request for invalid id', async () => {
          const res = await app.inject({
            method: HttpMethod.Post,
            url: '/items/recycle',
            query: { id: ['invalid-id', v4()] },
          });

          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });
      });
    });

    describe('POST /restore', () => {
      it('Throws if signed out', async () => {
        ({ app } = await build({ member: null }));

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/restore?id=${v4()}`,
        });

        expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });

      describe('Signed In', () => {
        let items: Item[];
        let itemIds: string[];
        beforeEach(async () => {
          ({ app, actor } = await build());
          const { item: item1 } = await testUtils.saveRecycledItem(actor);
          const { item: item2 } = await testUtils.saveRecycledItem(actor);
          const { item: item3 } = await testUtils.saveRecycledItem(actor);
          items = [item1, item2, item3];
          itemIds = items.map(({ id }) => id);
        });

        it('Successfully restore multiple items', async () => {
          const nonRecycledItemsCount = await testUtils.rawItemRepository.count();
          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/restore`,
            query: { id: itemIds },
          });

          expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
          await new Promise((res) => {
            setTimeout(async () => {
              const allItemsCount = await testUtils.rawItemRepository.count();
              expect(allItemsCount).toEqual(nonRecycledItemsCount + items.length);
              res(true);
            }, MULTIPLE_ITEMS_LOADING_TIME);
          });
        });

        it('Bad request for invalid id', async () => {
          const res = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/restore`,
            query: { id: ['invalid-id', v4()] },
          });

          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });

        it('Bad request if submit same id', async () => {
          const sameId = v4();
          const res = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/restore`,
            query: { id: [sameId, sameId] },
          });

          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });

        it('Bad request if submit too many ids', async () => {
          const res = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/restore`,
            query: { id: Array.from({ length: MAX_TARGETS_FOR_MODIFY_REQUEST }, () => v4()) },
          });

          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });

        it('Throws if has no admin rights on one item', async () => {
          const member = await saveMember();
          const { item } = await testUtils.saveItemAndMembership({
            member: actor,
            creator: member,
            permission: PermissionLevel.Write,
          });
          const initialCount = await testUtils.rawItemRepository.count();
          const initialCountRecycled = await recycledItemDataRawRepository.count();

          const res = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/restore`,
            query: { id: [...itemIds, item.id] },
          });
          expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

          // did not restore any items
          await new Promise((res) => {
            setTimeout(async () => {
              const allItemsCount = await testUtils.rawItemRepository.count();
              expect(allItemsCount).toEqual(initialCount);
              expect(await recycledItemDataRawRepository.count()).toEqual(initialCountRecycled);
              res(true);
            }, MULTIPLE_ITEMS_LOADING_TIME);
          });
        });

        it('Throws if one item does not exist', async () => {
          const initialCount = await testUtils.rawItemRepository.count();
          const initialCountRecycled = await recycledItemDataRawRepository.count();

          const res = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/restore`,
            query: { id: [...itemIds, v4()] },
          });
          expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

          // did not restore any items
          await new Promise((res) => {
            setTimeout(async () => {
              const allItemsCount = await testUtils.rawItemRepository.count();
              expect(allItemsCount).toEqual(initialCount);
              expect(await recycledItemDataRawRepository.count()).toEqual(initialCountRecycled);
              res(true);
            }, MULTIPLE_ITEMS_LOADING_TIME);
          });
        });
      });
    });
  });

  describe('Scenarios', () => {
    beforeEach(async () => {
      ({ app, actor } = await build());
    });

    /**
     * This is a regression test from a real production bug caused by not restoring the soft-deleted children
     */
    it('Restores the subtree successfully if it has children', async () => {
      const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: childItem } = await testUtils.saveItemAndMembership({
        member: actor,
        parentItem,
      });

      const recycle = await app.inject({
        method: HttpMethod.Post,
        url: `/items/recycle?id=${parentItem.id}`,
      });
      expect(recycle.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await recycledItemDataRawRepository.count()).toEqual(1);
      });
      expect(await testUtils.rawItemRepository.findOneBy({ id: childItem.id })).toBe(null);

      const restore = await app.inject({
        method: HttpMethod.Post,
        url: `/items/restore?id=${parentItem.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await recycledItemDataRawRepository.count()).toEqual(0);
      });

      const restoredChild = await testUtils.rawItemRepository.findOne({
        where: { id: childItem.id },
        relations: { creator: true },
      });
      // the recycle/restore operation changed the updatedAt value, but we can't know when from the outside
      expectItem(restoredChild!, childItem);
    });
  });
});
