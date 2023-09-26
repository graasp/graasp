import { StatusCodes } from 'http-status-codes';
import qs from 'qs';
import { In } from 'typeorm';
import { v4 } from 'uuid';
import waitForExpect from 'wait-for-expect';

import {
  HttpMethod,
  MAX_TARGETS_FOR_MODIFY_REQUEST,
  MAX_TARGETS_FOR_READ_REQUEST,
  PermissionLevel,
} from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { MULTIPLE_ITEMS_LOADING_TIME } from '../../../../../../test/constants';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { saveItemAndMembership } from '../../../../itemMembership/test/fixtures/memberships';
import { Member } from '../../../../member/entities/member';
import { BOB, saveMember } from '../../../../member/test/fixtures/members';
import { Item } from '../../../entities/Item';
import { ItemRepository } from '../../../repository';
import { expectManyItems, getDummyItem, saveItem } from '../../../test/fixtures/items';
import { RecycledItemDataRepository } from '../repository';
import { expectManyRecycledItems } from './fixtures';

// mock datasource
jest.mock('../../../../../plugins/datasource');

export const saveRecycledItem = async (member: Member, defaultItem?: Item) => {
  let item = defaultItem;
  if (!item) {
    ({ item } = await saveItemAndMembership({ member }));
  }
  await RecycledItemDataRepository.recycleOne(item, member);
  await ItemRepository.softRemove(item);
  return item;
};

describe('Recycle Bin Tests', () => {
  let app;
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
          method: HttpMethod.GET,
          url: '/items/recycled',
        });

        expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });

      describe('Signed In', () => {
        beforeEach(async () => {
          ({ app, actor } = await build());
        });

        it('Successfully get recycled items', async () => {
          const item0 = await saveRecycledItem(actor);
          const item1 = await saveRecycledItem(actor);

          // actor does not have access
          const member = await saveMember(BOB);
          await saveRecycledItem(member);

          // we should not get item2
          const recycled = [item0, item1];

          const res = await app.inject({
            method: HttpMethod.GET,
            url: '/items/recycled',
          });

          const response = res.json();
          expect(res.statusCode).toBe(StatusCodes.OK);

          const dbDeletedItems = await ItemRepository.find({
            where: { creator: { id: actor.id } },
            withDeleted: true,
          });
          expect(response).toHaveLength(recycled.length);
          expectManyItems(dbDeletedItems, recycled);
          // check response recycled item
          expectManyRecycledItems(response, recycled, actor);
        });

        it('Successfully get subitems recycled items', async () => {
          const item0 = await saveRecycledItem(actor);
          const { item: parentItem } = await saveItemAndMembership({ member: actor });
          const deletedChild = await saveItem({
            item: getDummyItem({ name: 'child' }),
            parentItem,
            actor,
          });
          await saveRecycledItem(actor, deletedChild);

          // actor does not have access
          const member = await saveMember(BOB);
          await saveRecycledItem(member);

          // we should not get item2
          const recycled = [item0, deletedChild];

          const res = await app.inject({
            method: HttpMethod.GET,
            url: '/items/recycled',
          });

          const response = res.json();
          expect(res.statusCode).toBe(StatusCodes.OK);

          expect(response).toHaveLength(recycled.length);
          const dbDeletedItems = response.map(({ item }) => item);
          expectManyItems(dbDeletedItems, recycled);
          // check response recycled item
          expectManyRecycledItems(response, recycled, actor);
        });
      });
    });

    // describe('POST /:id/recycle', () => {
    //   it('Throws if signed out', async () => {
    //     ({ app } = await build({ member: null }));
    //     const member = await saveMember(BOB);
    //     const { item } = await saveItemAndMembership({ member });

    //     const response = await app.inject({
    //       method: HttpMethod.POST,
    //       url: `/items/${item.id}/recycle`,
    //     });

    //     expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    //   });

    //   describe('Signed In', () => {
    //     beforeEach(async () => {
    //       ({ app, actor } = await build());
    //     });

    //     it('Successfully recycle an item', async () => {
    //       const { item } = await saveItemAndMembership({ member: actor });

    //       const res = await app.inject({
    //         method: HttpMethod.POST,
    //         url: `/items/${item.id}/recycle`,
    //       });

    //       expect(res.statusCode).toBe(StatusCodes.OK);
    //       expectRecycledItem(res.json(), item);
    //     });

    //     it('Cannot recycle an item if does not have rights', async () => {
    //       const member = await saveMember(BOB);
    //       const { item } = await saveItemAndMembership({ member });

    //       const res = await app.inject({
    //         method: HttpMethod.POST,
    //         url: `/items/${item.id}/recycle`,
    //       });

    //       expect(res.statusCode).toBe(StatusCodes.FORBIDDEN);
    //     });

    //     it('Cannot recycle an item already recycled: item not found', async () => {
    //       const item = await saveRecycledItem(actor);

    //       const res = await app.inject({
    //         method: HttpMethod.POST,
    //         url: `/items/${item.id}/recycle`,
    //       });

    //       expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
    //     });

    //     it('Bad request for invalid id', async () => {
    //       const res = await app.inject({
    //         method: HttpMethod.POST,
    //         url: '/items/invalid/recycle',
    //       });

    //       expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
    //     });
    //   });
    // });

    describe('POST /recycle', () => {
      it('Throws if signed out', async () => {
        ({ app } = await build({ member: null }));
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({ member });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/recycle?id=${item.id}`,
        });

        expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });

      describe('Signed In', () => {
        let items;
        let itemIds;
        beforeEach(async () => {
          ({ app, actor } = await build());
          const { item: item1 } = await saveItemAndMembership({ member: actor });
          const { item: item2 } = await saveItemAndMembership({ member: actor });
          const { item: item3 } = await saveItemAndMembership({ member: actor });
          items = [item1, item2, item3];
          itemIds = items.map(({ id }) => id);
        });

        it('Successfully recycle many items', async () => {
          const res = await app.inject({
            method: HttpMethod.POST,
            url: `/items/recycle?${qs.stringify({ id: itemIds }, { arrayFormat: 'repeat' })}`,
          });
          expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

          await new Promise((res) => {
            setTimeout(async () => {
              // check items are soft deleted
              const saved = await ItemRepository.find({
                withDeleted: true,
                where: { id: In(itemIds) },
              });
              expectManyItems(saved, items);
              const savedNotDeleted = await ItemRepository.find({ where: { id: In(itemIds) } });
              expect(savedNotDeleted).toHaveLength(0);

              // check recycle item entries
              const savedEntries = await RecycledItemDataRepository.find({
                where: { item: { path: In(items.map(({ path }) => path)) } },
              });
              expectManyRecycledItems(savedEntries, saved);
              res(true);
            }, MULTIPLE_ITEMS_LOADING_TIME);
          });
        });

        it('Returns error in array if does not have rights on one item', async () => {
          const member = await saveMember(BOB);
          const errorItem = await saveRecycledItem(member);
          const res = await app.inject({
            method: HttpMethod.POST,
            url: `/items/recycle?${qs.stringify(
              { id: [items.map(({ id }) => id), errorItem.id] },
              { arrayFormat: 'repeat' },
            )}`,
          });

          expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

          await new Promise((res) => {
            setTimeout(async () => {
              // check items are NOT soft deleted
              const savedNotDeleted = await ItemRepository.find({ where: { id: In(itemIds) } });
              expect(savedNotDeleted).toHaveLength(items.length);

              // check NO recycle item entries
              const savedEntries = await RecycledItemDataRepository.find({
                where: { item: { path: In(items.map(({ path }) => path)) } },
              });
              expect(savedEntries).toHaveLength(0);

              res(true);
            }, MULTIPLE_ITEMS_LOADING_TIME);
          });
        });

        it('Bad request if recycle more than maxItemsInRequest items', async () => {
          const items = Array.from({ length: MAX_TARGETS_FOR_READ_REQUEST + 1 }, () =>
            getDummyItem(),
          );

          const res = await app.inject({
            method: HttpMethod.POST,
            url: `/items/recycle?${qs.stringify(
              { id: items.map(({ id }) => id) },
              { arrayFormat: 'repeat' },
            )}`,
          });
          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });

        it('Bad request for invalid id', async () => {
          const res = await app.inject({
            method: HttpMethod.POST,
            url: `/items/recycle?${qs.stringify(
              { id: ['invalid-id', v4()] },
              { arrayFormat: 'repeat' },
            )}`,
          });

          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });
      });
    });

    // describe('POST /:id/restore', () => {
    //   it('Throws if signed out', async () => {
    //     ({ app } = await build({ member: null }));
    //     const member = await saveMember(BOB);
    //     const { item } = await saveItemAndMembership({ member });

    //     const response = await app.inject({
    //       method: HttpMethod.POST,
    //       url: `${ITEMS_ROUTE_PREFIX}/${item.id}/restore`,
    //     });

    //     expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    //   });

    //   describe('Signed In', () => {
    //     let item;
    //     beforeEach(async () => {
    //       ({ app, actor } = await build());
    //       item = await saveRecycledItem(actor);
    //     });

    //     it('Successfully restore an item', async () => {
    //       const initialCount = (await RecycledItemDataRepository.find()).length;

    //       const response = await app.inject({
    //         method: HttpMethod.POST,
    //         url: `${ITEMS_ROUTE_PREFIX}/${item.id}/restore`,
    //       });
    //       expect(response.statusCode).toBe(StatusCodes.OK);
    //       expect(await RecycledItemDataRepository.find()).toHaveLength(initialCount - 1);
    //       expect(response.json().id).toBeTruthy();
    //       expectManyRecycledItems([response.json()], [item], actor);
    //     });

    //     it('Bad request for invalid id', async () => {
    //       const res = await app.inject({
    //         method: HttpMethod.POST,
    //         url: `${ITEMS_ROUTE_PREFIX}/invalid/restore`,
    //       });

    //       expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
    //     });

    //     it('Throws if item does not exist', async () => {
    //       const res = await app.inject({
    //         method: HttpMethod.POST,
    //         url: `${ITEMS_ROUTE_PREFIX}/${v4()}/restore`,
    //       });

    //       expect(res.json()).toMatchObject(new ItemNotFound(expect.anything()));
    //     });
    //     it('Throws if item is not recycled', async () => {
    //       const { item } = await saveItemAndMembership({ member: actor });

    //       const res = await app.inject({
    //         method: HttpMethod.POST,
    //         url: `${ITEMS_ROUTE_PREFIX}/${item.id}/restore`,
    //       });

    //       expect(res.json()).toMatchObject(new CannotRestoreNonDeletedItem(expect.anything()));
    //     });
    //     it('Throws if has only write permission over item', async () => {
    //       const member = await saveMember(BOB);
    //       const item = await saveRecycledItem(member);
    //       await ItemMembershipRepository.save({
    //         item,
    //         member: actor,
    //         permission: PermissionLevel.Write,
    //       });

    //       const res = await app.inject({
    //         method: HttpMethod.POST,
    //         url: `${ITEMS_ROUTE_PREFIX}/${item.id}/restore`,
    //       });

    //       expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
    //     });
    //     it('Throws if has only read permission over item', async () => {
    //       const member = await saveMember(BOB);
    //       const item = await saveRecycledItem(member);
    //       await ItemMembershipRepository.save({
    //         item,
    //         member: actor,
    //         permission: PermissionLevel.Read,
    //       });

    //       const res = await app.inject({
    //         method: HttpMethod.POST,
    //         url: `${ITEMS_ROUTE_PREFIX}/${item.id}/restore`,
    //       });

    //       expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
    //     });
    //     it('Throws if has no permission over item', async () => {
    //       const member = await saveMember(BOB);
    //       const item = await saveRecycledItem(member);

    //       const res = await app.inject({
    //         method: HttpMethod.POST,
    //         url: `${ITEMS_ROUTE_PREFIX}/${item.id}/restore`,
    //       });

    //       expect(res.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
    //     });
    //   });
    // });

    describe('POST /restore', () => {
      it('Throws if signed out', async () => {
        ({ app } = await build({ member: null }));

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/restore?id=${v4()}`,
        });

        expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });

      describe('Signed In', () => {
        let items, itemIds;
        beforeEach(async () => {
          ({ app, actor } = await build());
          const item1 = await saveRecycledItem(actor);
          const item2 = await saveRecycledItem(actor);
          const item3 = await saveRecycledItem(actor);
          items = [item1, item2, item3];
          itemIds = items.map(({ id }) => id);
        });

        it('Successfully restore multiple items', async () => {
          const nonRecycledItems = await ItemRepository.find();
          const response = await app.inject({
            method: HttpMethod.POST,
            url: `${ITEMS_ROUTE_PREFIX}/restore?${qs.stringify(
              { id: itemIds },
              { arrayFormat: 'repeat' },
            )}`,
          });

          expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
          await new Promise((res) => {
            setTimeout(async () => {
              const allItems = await ItemRepository.find();
              expect(allItems).toHaveLength(nonRecycledItems.length + items.length);
              res(true);
            }, MULTIPLE_ITEMS_LOADING_TIME);
          });
        });

        it('Bad request for invalid id', async () => {
          const res = await app.inject({
            method: HttpMethod.POST,
            url: `${ITEMS_ROUTE_PREFIX}/restore?${qs.stringify(
              { id: ['invalid-id', v4()] },
              { arrayFormat: 'repeat' },
            )}`,
          });

          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });

        it('Bad request if submit same id', async () => {
          const sameId = v4();
          const res = await app.inject({
            method: HttpMethod.POST,
            url: `${ITEMS_ROUTE_PREFIX}/restore?${qs.stringify(
              { id: [sameId, sameId] },
              { arrayFormat: 'repeat' },
            )}`,
          });

          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });

        it('Bad request if submit too many ids', async () => {
          const res = await app.inject({
            method: HttpMethod.POST,
            url: `${ITEMS_ROUTE_PREFIX}/restore?${qs.stringify(
              { id: Array.from({ length: MAX_TARGETS_FOR_MODIFY_REQUEST }, () => v4()) },
              { arrayFormat: 'repeat' },
            )}`,
          });

          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });

        it('Throws if has no admin rights on one item', async () => {
          const member = await saveMember(BOB);
          const { item } = await saveItemAndMembership({
            member: actor,
            creator: member,
            permission: PermissionLevel.Write,
          });
          const initialCount = await ItemRepository.find();
          const initialCountRecycled = await RecycledItemDataRepository.find();

          const res = await app.inject({
            method: HttpMethod.POST,
            url: `${ITEMS_ROUTE_PREFIX}/restore?${qs.stringify(
              { id: [itemIds, item.id] },
              { arrayFormat: 'repeat' },
            )}`,
          });
          expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

          // did not restore any items
          await new Promise((res) => {
            setTimeout(async () => {
              const allItems = await ItemRepository.find();
              expect(allItems).toHaveLength(initialCount.length);
              expect(await RecycledItemDataRepository.find()).toHaveLength(
                initialCountRecycled.length,
              );
              res(true);
            }, MULTIPLE_ITEMS_LOADING_TIME);
          });
        });

        it('Throws if one item does not exist', async () => {
          const initialCount = await ItemRepository.find();
          const initialCountRecycled = await RecycledItemDataRepository.find();

          const res = await app.inject({
            method: HttpMethod.POST,
            url: `${ITEMS_ROUTE_PREFIX}/restore?${qs.stringify(
              { id: [itemIds, v4()] },
              { arrayFormat: 'repeat' },
            )}`,
          });
          expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

          // did not restore any items
          await new Promise((res) => {
            setTimeout(async () => {
              const allItems = await ItemRepository.find();
              expect(allItems).toHaveLength(initialCount.length);
              expect(await RecycledItemDataRepository.find()).toHaveLength(
                initialCountRecycled.length,
              );
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
      const { item: parentItem } = await saveItemAndMembership({ member: actor });
      const { item: childItem } = await saveItemAndMembership({ member: actor, parentItem });

      const recycle = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${parentItem.id}`,
      });
      expect(recycle.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });
      expect(await ItemRepository.findOneBy({ id: childItem.id })).toBe(null);

      const restore = await app.inject({
        method: HttpMethod.POST,
        url: `/items/restore?id=${parentItem.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(0);
      });

      const restoredChild = await ItemRepository.get(childItem.id);
      // the recycle/restore operation changed the updatedAt value, but we can't know when from the outside
      expect({ ...restoredChild, updatedAt: undefined }).toMatchObject({
        ...childItem,
        updatedAt: undefined,
      });
    });
  });
});
