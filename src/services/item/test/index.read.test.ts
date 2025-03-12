import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { v4 as uuidv4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import {
  HttpMethod,
  ItemType,
  ItemVisibilityType,
  MemberFactory,
  PermissionLevel,
} from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../../test/app';
import { seedFromJson } from '../../../../test/mocks/seed';
import { db } from '../../../drizzle/db';
import { Item, ItemMembershipRaw, ItemVisibilityRaw } from '../../../drizzle/types';
import { MinimalMember } from '../../../types';
import { assertIsDefined } from '../../../utils/assertions';
import { ItemNotFound, MemberCannotAccess } from '../../../utils/errors';
import { assertIsMemberForTest } from '../../authentication';
import { ItemWrapper, PackedItem } from '../ItemWrapper';
import { Ordering, SortBy } from '../types';
import { expectManyPackedItems, expectPackedItem, expectThumbnails } from './fixtures/items';

/**
 *
 * @param resultItems ResultOf items
 * @param correctItems
 * @param itemMemberships we suppose item memberships is ordered in the same order as correctItems
 * @param creator
 * @param itemVisibilities
 */
const expectPackedItems = (
  resultItems,
  correctItems,
  itemMemberships?: ItemMembershipRaw[],
  creator?: MinimalMember,
  itemVisibilities?: ItemVisibilityRaw[],
) => {
  correctItems.forEach(({ id, path }) => {
    const idx = correctItems.findIndex(({ id: thisId }) => thisId === id);
    const item = resultItems[id];
    expectPackedItem(
      item,
      new ItemWrapper(
        { ...correctItems[idx], creator },
        itemMemberships?.[idx],
        itemVisibilities?.filter((iv) => path.includes(iv.itemPath)),
      ).packed(),
      creator,
    );
  });
};

// Mock S3 libraries
const deleteObjectMock = jest.fn(async () => console.debug('deleteObjectMock'));
const copyObjectMock = jest.fn(async () => console.debug('copyObjectMock'));
const headObjectMock = jest.fn(async () => ({ ContentLength: 10 }));
const uploadDoneMock = jest.fn(async () => console.debug('aws s3 storage upload'));
const MOCK_SIGNED_URL = 'signed-url';
jest.mock('@aws-sdk/client-s3', () => {
  return {
    GetObjectCommand: jest.fn(),
    S3: function () {
      return {
        copyObject: copyObjectMock,
        deleteObject: deleteObjectMock,
        headObject: headObjectMock,
      };
    },
  };
});
jest.mock('@aws-sdk/s3-request-presigner', () => {
  const getSignedUrl = jest.fn(async () => MOCK_SIGNED_URL);
  return {
    getSignedUrl,
  };
});
jest.mock('@aws-sdk/lib-storage', () => {
  return {
    Upload: jest.fn().mockImplementation(() => {
      return {
        done: uploadDoneMock,
      };
    }),
  };
});

describe('Item routes tests', () => {
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

  describe('GET /items/:id', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{}] });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${item.id}`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    describe('Signed In', () => {
      it('Returns successfully', async () => {
        const {
          actor,
          items: [item],
          itemMemberships: [itemMembership],
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] }],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}`,
        });

        const returnedItem = response.json();
        expectPackedItem(
          returnedItem,
          new ItemWrapper({ ...item, creator: actor }, itemMembership).packed(),
          actor,
        );
        expectThumbnails(returnedItem, MOCK_SIGNED_URL, false);
        expect(response.statusCode).toBe(StatusCodes.OK);
      });

      it('Return successfully with thumbnails', async () => {
        const {
          actor,
          items: [item],
          itemMemberships: [im],
        } = await seedFromJson({
          items: [
            {
              settings: { hasThumbnail: true },
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}`,
        });

        const returnedItem = response.json();
        expectPackedItem(
          returnedItem,
          new ItemWrapper({ ...item, creator: actor }, im).packed(),
          actor,
        );
        expect(response.statusCode).toBe(StatusCodes.OK);

        expectThumbnails(returnedItem, MOCK_SIGNED_URL, true);
      });

      it('Returns successfully with permission', async () => {
        const {
          actor,
          items: [item],
          itemMemberships: [im],
        } = await seedFromJson({
          items: [
            {
              settings: { hasThumbnail: true },
              memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}`,
        });

        const returnedItem = response.json();
        expectPackedItem(
          returnedItem,
          new ItemWrapper({ ...item, creator: actor }, im).packed(),
          actor,
        );
        expect(response.statusCode).toBe(StatusCodes.OK);
      });

      it('Bad Request for invalid id', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/items/invalid-id',
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Cannot get item if have no membership', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{}],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}`,
        });

        expect(response.json()).toEqual(new MemberCannotAccess(item.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });

    describe('Public', () => {
      it('Returns successfully', async () => {
        const {
          actor,
          items: [item],
          itemVisibilities: [publicVisibility],
        } = await seedFromJson({
          items: [{ isPublic: true }],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}`,
        });

        const returnedItem = response.json();
        expectPackedItem(returnedItem, { ...item, permission: null }, actor, undefined, [
          publicVisibility,
        ]);
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
      it('Returns successfully for write right', async () => {
        const {
          actor,
          items: [item],
          itemVisibilities: [publicVisibility],
        } = await seedFromJson({
          items: [
            {
              isPublic: true,
              memberships: [{ permission: PermissionLevel.Write, account: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}`,
        });

        const returnedItem = response.json();
        expectPackedItem(
          returnedItem,
          { ...item, permission: PermissionLevel.Write },
          actor,
          undefined,
          [publicVisibility],
        );
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
    });
  });
  // get many items
  describe('GET /items?id=<id>', () => {
    // warning: this will change if it becomes a public endpoint
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        actor: null,
        items: [{}],
      });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/items',
        query: { id: [item.id] },
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.json().errors[0]).toMatchObject(new MemberCannotAccess(item.id));
    });

    describe('Signed In', () => {
      it('Returns successfully', async () => {
        const { actor, items, itemMemberships } = await seedFromJson({
          items: [
            { memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] },
            { memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] },
            { memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/items',
          query: { id: items.map(({ id }) => id) },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const { data, errors } = response.json();
        expect(errors).toHaveLength(0);

        expectPackedItems(data, items, itemMemberships, actor);
        Object.values(data).forEach((item) =>
          expectThumbnails(item as PackedItem, MOCK_SIGNED_URL, false),
        );
      });
      it('Returns successfully with thumbnails', async () => {
        // const items: PackedItem[] = [];
        // for (let i = 0; i < 3; i++) {
        //   const { packedItem } = await testUtils.saveItemAndMembership({
        //     member: actor,
        //     item: { settings: { hasThumbnail: true } },
        //   });
        //   items.push(packedItem);
        // }

        const { actor, items, itemMemberships } = await seedFromJson({
          items: [
            {
              settings: { hasThumbnail: true },
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              settings: { hasThumbnail: true },
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              settings: { hasThumbnail: true },
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/items',
          query: { id: items.map(({ id }) => id) },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const { data, errors } = response.json();

        expect(errors).toHaveLength(0);
        expectPackedItems(data, items, itemMemberships, actor);
        Object.values(data).forEach((item) =>
          expectThumbnails(item as PackedItem, MOCK_SIGNED_URL, true),
        );
      });
      it('Returns one item successfully for valid item', async () => {
        const {
          actor,
          items: [item],
          itemMemberships: [im],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/items',
          query: { id: [item.id] },
        });
        expectPackedItem(
          response.json().data[item.id],
          new ItemWrapper(
            {
              ...item,
              creator: actor,
            },
            im,
          ).packed(),
        );
        expect(response.json().errors).toHaveLength(0);
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
      it('Bad request for one invalid item', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/items',
          query: { id: [item.id, 'invalid-id'] },
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Returns one error for one missing item', async () => {
        const missingId = uuidv4();

        const { actor, items, itemMemberships } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/items',
          query: { id: [...items.map(({ id }) => id), missingId] },
        });
        const { data, errors } = response.json();
        expect(response.statusCode).toBe(StatusCodes.OK);

        expectPackedItems(data, items, itemMemberships, actor);
        expect(data[missingId]).toBeFalsy();
        expect(errors).toContainEqual(new ItemNotFound(missingId));
      });
    });

    describe('Public', () => {
      it('Returns successfully', async () => {
        const {
          items,
          itemVisibilities,
          members: [member],
        } = await seedFromJson({
          actor: null,
          items: [
            {
              isPublic: true,
              creator: { name: 'bob' },
            },
            {
              isPublic: true,
              creator: { name: 'bob' },
            },
            {
              isPublic: true,
              creator: { name: 'bob' },
            },
          ],
        });

        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/items',
          query: { id: items.map(({ id }) => id) },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const { data, errors } = response.json();
        expect(errors).toHaveLength(0);
        expectPackedItems(data, items, [], member, itemVisibilities);
      });
    });
  });
  // describe('GET /items/own', () => {
  //   it('Throws if signed out', async () => {
  //     const member = await saveMember();
  //     await testUtils.saveItemAndMembership({ member });

  //     const response = await app.inject({
  //       method: HttpMethod.Get,
  //       url: '/items/own',
  //     });

  //     expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  //   });

  //     describe('Signed In', () => {
  //       beforeEach(async () => {
  //         actor = await saveMember();
  //         mockAuthenticate(actor);
  //       });

  //       it('Returns successfully', async () => {
  //         const { item: item1 } = await testUtils.saveItemAndMembership({ member: actor });
  //         const { item: item2 } = await testUtils.saveItemAndMembership({ member: actor });
  //         const { item: item3 } = await testUtils.saveItemAndMembership({ member: actor });
  //         const items = [item1, item2, item3];

  //         const response = await app.inject({
  //           method: HttpMethod.Get,
  //           url: '/items/own',
  //         });

  //         expect(response.statusCode).toBe(StatusCodes.OK);

  //         const data = response.json();
  //         expect(data).toHaveLength(items.length);
  //         items.forEach(({ id }) => {
  //           expectItem(
  //             data.find(({ id: thisId }) => thisId === id),
  //             items.find(({ id: thisId }) => thisId === id),
  //           );
  //         });
  //       });
  //     });
  //   });
  //   describe('GET /items/shared-with', () => {
  //     it('Throws if signed out', async () => {
  //       const member = await saveMember();
  //       await testUtils.saveItemAndMembership({ member });

  //       const response = await app.inject({
  //         method: HttpMethod.Get,
  //         url: '/items/own',
  //       });

  //       expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  //     });

  //     describe('Signed In', () => {
  //       let items;
  //       let member;

  //       beforeEach(async () => {
  //         actor = await saveMember();
  //         mockAuthenticate(actor);

  //         member = await saveMember();
  //         const { item: item1 } = await testUtils.saveItemAndMembership({ member });
  //         const { item: item2 } = await testUtils.saveItemAndMembership({ member });
  //         const { item: item3 } = await testUtils.saveItemAndMembership({ member });
  //         items = [item1, item2, item3];
  //         await testUtils.saveMembership({ item: item1, account: actor });
  //         await testUtils.saveMembership({
  //           item: item2,
  //           account: actor,
  //           permission: PermissionLevel.Write,
  //         });
  //         await testUtils.saveMembership({
  //           item: item3,
  //           account: actor,
  //           permission: PermissionLevel.Read,
  //         });

  //         // save own item that should not be returned
  //         await testUtils.saveItemAndMembership({ member: actor });
  //       });

  //       it('Returns successfully', async () => {
  //         const response = await app.inject({
  //           method: HttpMethod.Get,
  //           url: '/items/shared-with',
  //         });

  //         expect(response.statusCode).toBe(StatusCodes.OK);
  //         const data = response.json();
  //         expect(data).toHaveLength(items.length);
  //         items.forEach(({ id }) => {
  //           expectItem(
  //             data.find(({ id: thisId }) => thisId === id),
  //             items.find(({ id: thisId }) => thisId === id),
  //           );
  //         });
  //       });

  //       it('Returns successfully with read permission filter', async () => {
  //         const response = await app.inject({
  //           method: HttpMethod.Get,
  //           url: '/items/shared-with?permission=read',
  //         });
  //         const data = response.json();
  //         expect(data).toHaveLength(items.length);
  //         items.forEach(({ id }) => {
  //           expectItem(
  //             data.find(({ id: thisId }) => thisId === id),
  //             items.find(({ id: thisId }) => thisId === id),
  //           );
  //         });
  //         expect(response.statusCode).toBe(StatusCodes.OK);
  //       });

  //       it('Returns successfully with write permission filter', async () => {
  //         const validItems = items.slice(0, 2);
  //         const response = await app.inject({
  //           method: HttpMethod.Get,
  //           url: '/items/shared-with?permission=write',
  //         });
  //         const data = response.json();
  //         expect(data).toHaveLength(validItems.length);

  //         validItems.forEach(({ id }) => {
  //           expectItem(
  //             data.find(({ id: thisId }) => thisId === id),
  //             validItems.find(({ id: thisId }) => thisId === id),
  //           );
  //         });
  //         expect(response.statusCode).toBe(StatusCodes.OK);
  //       });

  //       it('Returns successfully with admin permission filter', async () => {
  //         const validItems = items.slice(0, 1);
  //         const response = await app.inject({
  //           method: HttpMethod.Get,
  //           url: '/items/shared-with?permission=admin',
  //         });
  //         const data = response.json();
  //         expect(data).toHaveLength(validItems.length);

  //         validItems.forEach(({ id }) => {
  //           expectItem(
  //             data.find(({ id: thisId }) => thisId === id),
  //             validItems.find(({ id: thisId }) => thisId === id),
  //           );
  //         });
  //         expect(response.statusCode).toBe(StatusCodes.OK);
  //       });

  //       it('Returns successfully shared siblings', async () => {
  //         // create siblings
  //         const { item: parentItem } = await testUtils.saveItemAndMembership({ member });
  //         const { item: item1 } = await testUtils.saveItemAndMembership({ member, parentItem });
  //         const { item: item2 } = await testUtils.saveItemAndMembership({ member, parentItem });
  //         items = [item1, item2];
  //         await testUtils.saveMembership({
  //           item: item1,
  //           account: actor,
  //           permission: PermissionLevel.Read,
  //         });
  //         await testUtils.saveMembership({
  //           item: item2,
  //           account: actor,
  //           permission: PermissionLevel.Write,
  //         });

  //         const response = await app.inject({
  //           method: HttpMethod.Get,
  //           url: '/items/shared-with',
  //         });

  //         expect(response.statusCode).toBe(StatusCodes.OK);
  //         const data = response.json();
  //         // should at least contain both siblings
  //         items.forEach(({ id }) => {
  //           expectItem(
  //             data.find(({ id: thisId }) => thisId === id),
  //             items.find(({ id: thisId }) => thisId === id),
  //           );
  //         });
  //       });

  //       it('Should return only parent if parent and siblings are shared', async () => {
  //         // create siblings
  //         const { item: parentItem } = await testUtils.saveItemAndMembership({ member });
  //         const { item: item1 } = await testUtils.saveItemAndMembership({ member, parentItem });
  //         const { item: item2 } = await testUtils.saveItemAndMembership({ member, parentItem });
  //         await testUtils.saveMembership({
  //           item: parentItem,
  //           account: actor,
  //           permission: PermissionLevel.Read,
  //         });
  //         await testUtils.saveMembership({
  //           item: item1,
  //           account: actor,
  //           permission: PermissionLevel.Read,
  //         });
  //         await testUtils.saveMembership({
  //           item: item2,
  //           account: actor,
  //           permission: PermissionLevel.Write,
  //         });

  //         const response = await app.inject({
  //           method: HttpMethod.Get,
  //           url: '/items/shared-with',
  //         });

  //         expect(response.statusCode).toBe(StatusCodes.OK);
  //         const data = response.json();
  //         // should contain parent but not children
  //         expectItem(
  //           data.find(({ id: thisId }) => thisId === parentItem.id),
  //           parentItem,
  //         );
  //         expect(data.find(({ id: thisId }) => thisId === item1.id)).toBeFalsy();
  //         expect(data.find(({ id: thisId }) => thisId === item2.id)).toBeFalsy();
  //       });
  //     });
  //   });
  describe('GET /items/accessible', () => {
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/items/accessible',
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Returns successfully owned and shared items', async () => {
        const {
          actor,
          items: [parentItem1, _child1, item2, item3, parentItem4, _child4, _parentItem5, item6],
          itemMemberships,
        } = await seedFromJson({
          items: [
            // owned items
            {
              name: 'parentItem1',
              creator: 'actor',
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [{ name: 'should-not-return' }],
            },
            {
              name: 'item2',
              creator: 'actor',
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              name: 'item3',
              creator: 'actor',
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            // shared
            {
              name: 'parentItem4',
              creator: { name: 'bob' },
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [{ name: 'should-not-return' }],
            },
            {
              name: 'parentItem5',
              creator: { name: 'bob' },
              children: [
                {
                  memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
                  name: 'item6',
                  creator: { name: 'bob' },
                },
              ],
            },

            // should not return these items
            {
              name: 'is-not-accessible',
              creator: { name: 'bob' },
            },
          ],
        });
        // const { packedItem: item1, item: parentItem1 } = await testUtils.saveItemAndMembership({
        //   member: actor,
        // });
        // const { packedItem: item2 } = await testUtils.saveItemAndMembership({ member: actor });
        // const { packedItem: item3 } = await testUtils.saveItemAndMembership({ member: actor });

        // shared
        // const bob = await saveMember();
        // const { packedItem: item4, item: parentItem4 } = await testUtils.saveItemAndMembership({
        //   member: actor,
        //   creator: bob,
        // });
        // const { item: parentItem5 } = await testUtils.saveItemAndMembership({ member: bob });
        // const { packedItem: item6 } = await testUtils.saveItemAndMembership({
        //   member: actor,
        //   creator: bob,
        //   parentItem: parentItem5,
        // });

        // should not return these items
        // await testUtils.saveItemAndMembership({ member: bob });
        // await testUtils.saveItemAndMembership({ member: actor, parentItem: parentItem1 });
        // await testUtils.saveItemAndMembership({ member: actor, parentItem: parentItem4 });

        const items = [parentItem1, item2, item3, parentItem4, item6];

        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/items/accessible',
        });
        console.log(response);
        expect(response.statusCode).toBe(StatusCodes.OK);

        const { data, totalCount } = response.json<{ data: PackedItem[]; totalCount: number }>();
        expect(totalCount).toEqual(items.length);
        expect(data).toHaveLength(items.length);

        // expectManyPackedItems(data, items);

        data.forEach((i) => expectThumbnails(i, MOCK_SIGNED_URL, false));
      });

      //       it('Returns items, some with thumbnails', async () => {
      //         // owned items
      //         await testUtils.saveItemAndMembership({
      //           member: actor,
      //         });
      //         const { packedItem: item2 } = await testUtils.saveItemAndMembership({
      //           member: actor,
      //           item: { settings: { hasThumbnail: true } },
      //         });
      //         await testUtils.saveItemAndMembership({ member: actor });

      //         // shared
      //         const bob = await saveMember();
      //         await testUtils.saveItemAndMembership({
      //           member: actor,
      //           creator: bob,
      //         });
      //         const { item: parentItem5 } = await testUtils.saveItemAndMembership({ member: bob });
      //         const { packedItem: item6 } = await testUtils.saveItemAndMembership({
      //           member: actor,
      //           creator: bob,
      //           parentItem: parentItem5,
      //           item: { settings: { hasThumbnail: true } },
      //         });

      //         const itemsWithThumbnails = [item2, item6];

      //         const response = await app.inject({
      //           method: HttpMethod.Get,
      //           url: '/items/accessible',
      //         });

      //         expect(response.statusCode).toBe(StatusCodes.OK);

      //         const { data } = response.json<{ data: PackedItem[] }>();

      //         data.forEach((i) => {
      //           expectThumbnails(
      //             i,
      //             MOCK_SIGNED_URL,
      //             Boolean(itemsWithThumbnails.find((item) => item.id === i.id)),
      //           );
      //         });
    });

    //       it('Returns successfully items for member id', async () => {
    //         await testUtils.saveItemAndMembership({ member: actor });
    //         await testUtils.saveItemAndMembership({ member: actor });
    //         await testUtils.saveItemAndMembership({ member: actor });

    //         const bob = await saveMember();
    //         const { packedItem: item1 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           creator: bob,
    //         });
    //         const { packedItem: item2 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           creator: bob,
    //         });

    //         const items = [item1, item2];

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/accessible?creatorId=${bob.id}`,
    //         });

    //         expect(response.statusCode).toBe(StatusCodes.OK);

    //         const { data, totalCount } = response.json();
    //         expect(totalCount).toEqual(items.length);
    //         expect(data).toHaveLength(items.length);
    //         expectManyPackedItems(data, items);
    //       });

    //       it('Returns successfully sorted items by name asc', async () => {
    //         const { packedItem: item1 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { name: '2' },
    //         });
    //         const { packedItem: item2 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { name: '3' },
    //         });
    //         const { packedItem: item3 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { name: '1' },
    //         });

    //         const items = [item3, item1, item2];

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/accessible?sortBy=${SortBy.ItemName}&ordering=asc`,
    //         });

    //         expect(response.statusCode).toBe(StatusCodes.OK);

    //         const { data, totalCount } = response.json();
    //         expect(totalCount).toEqual(items.length);
    //         expect(data).toHaveLength(items.length);
    //         expectManyPackedItems(data, items);
    //       });

    //       it('Returns successfully sorted items by type desc', async () => {
    //         const { packedItem: item1 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { type: ItemType.DOCUMENT },
    //         });
    //         const { packedItem: item2 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { type: ItemType.FOLDER },
    //         });
    //         const { packedItem: item3 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { type: ItemType.APP },
    //         });

    //         const items = [item2, item1, item3];

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/accessible?sortBy=${SortBy.ItemType}&ordering=desc`,
    //         });

    //         expect(response.statusCode).toBe(StatusCodes.OK);

    //         const { data, totalCount } = response.json();
    //         expect(totalCount).toEqual(items.length);
    //         expect(data).toHaveLength(items.length);
    //         expectManyPackedItems(data, items);
    //       });

    //       it('Returns successfully sorted items by creator name asc', async () => {
    //         const anna = await saveMember(MemberFactory({ name: 'anna' }));
    //         const bob = await saveMember(MemberFactory({ name: 'bob' }));
    //         const cedric = await saveMember(MemberFactory({ name: 'cedric' }));
    //         const { packedItem: item1 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           creator: bob,
    //           item: { type: ItemType.DOCUMENT },
    //         });
    //         const { packedItem: item2 } = await testUtils.saveItemAndMembership({
    //           creator: anna,
    //           member: actor,
    //           item: { type: ItemType.FOLDER },
    //         });
    //         const { packedItem: item3 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           creator: cedric,
    //           item: { type: ItemType.APP },
    //         });

    //         const items = [item2, item1, item3];

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/accessible?sortBy=${SortBy.ItemCreatorName}&ordering=asc`,
    //         });

    //         expect(response.statusCode).toBe(StatusCodes.OK);

    //         const { data, totalCount } = response.json();
    //         expect(totalCount).toEqual(items.length);
    //         expect(data).toHaveLength(items.length);
    //         expectManyPackedItems(data, items);
    //       });

    //       it('Returns successfully items for search', async () => {
    //         const { packedItem: item1 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { name: 'dog' },
    //         });
    //         const { packedItem: item2 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { name: 'dog' },
    //         });
    //         await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { name: 'cat' },
    //         });
    //         // noise
    //         const member = await saveMember();
    //         await testUtils.saveItemAndMembership({
    //           member,
    //           item: { name: 'dog' },
    //         });

    //         const items = [item1, item2];

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/accessible`,
    //           query: { keywords: ['dogs'] },
    //         });

    //         expect(response.statusCode).toBe(StatusCodes.OK);

    //         const { data, totalCount } = response.json();
    //         expect(totalCount).toEqual(items.length);
    //         expect(data).toHaveLength(items.length);
    //         expectManyPackedItems(data, items);
    //       });

    //       it('Returns successfully items by read', async () => {
    //         const bob = await saveMember();
    //         const { packedItem: item1 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           creator: bob,
    //           permission: PermissionLevel.Read,
    //           item: { type: ItemType.DOCUMENT },
    //         });

    //         // noise
    //         await testUtils.saveItemAndMembership({
    //           member: actor,
    //           permission: PermissionLevel.Admin,
    //           item: { type: ItemType.FOLDER },
    //         });
    //         await testUtils.saveItemAndMembership({
    //           member: actor,
    //           creator: bob,
    //           permission: PermissionLevel.Write,
    //           item: { type: ItemType.APP },
    //         });

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/accessible`,
    //           query: {
    //             sortBy: SortBy.ItemCreatorName,
    //             ordering: 'asc',
    //             permissions: [PermissionLevel.Read],
    //           },
    //         });

    //         expect(response.statusCode).toBe(StatusCodes.OK);

    //         const { data, totalCount } = response.json();
    //         expect(totalCount).toEqual(1);
    //         expect(data).toHaveLength(1);
    //         expectPackedItem(data[0], item1);
    //       });

    //       it('Returns successfully items by write and admin', async () => {
    //         const anna = await saveMember(MemberFactory({ name: 'anna' }));
    //         const bob = await saveMember(MemberFactory({ name: 'bob' }));
    //         await testUtils.saveItemAndMembership({
    //           member: actor,
    //           creator: bob,
    //           permission: PermissionLevel.Read,
    //           item: { type: ItemType.DOCUMENT },
    //         });
    //         const { packedItem: item2 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           creator: anna,
    //           permission: PermissionLevel.Admin,
    //           item: { type: ItemType.FOLDER },
    //         });
    //         const { packedItem: item3 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           creator: bob,
    //           permission: PermissionLevel.Write,
    //           item: { type: ItemType.APP },
    //         });
    //         const items = [item2, item3];

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/accessible`,
    //           query: {
    //             sortBy: SortBy.ItemCreatorName,
    //             ordering: 'asc',
    //             permissions: [PermissionLevel.Write, PermissionLevel.Admin],
    //           },
    //         });

    //         expect(response.statusCode).toBe(StatusCodes.OK);

    //         const { data, totalCount } = response.json();
    //         expect(totalCount).toEqual(items.length);
    //         expect(data).toHaveLength(items.length);
    //         expectManyPackedItems(data, items);
    //       });

    //       it('Returns successfully folder items', async () => {
    //         const bob = await saveMember();
    //         const { packedItem: itemFolder1 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           permission: PermissionLevel.Admin,
    //           item: { type: ItemType.FOLDER },
    //         });
    //         const { packedItem: itemFolder2 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           permission: PermissionLevel.Write,
    //           item: { type: ItemType.FOLDER },
    //         });
    //         const { packedItem: notAFolder } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           creator: bob,
    //           permission: PermissionLevel.Write,
    //           item: { type: ItemType.APP },
    //         });

    //         const sortByName = (a, b) => a.name.localeCompare(b.name);

    //         const folders = [itemFolder1, itemFolder2].sort(sortByName);

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/accessible`,
    //           query: {
    //             types: [ItemType.FOLDER],
    //           },
    //         });

    //         expect(response.statusCode).toBe(StatusCodes.OK);

    //         const { data, totalCount } = response.json();
    //         const sortedData = data.sort(sortByName);
    //         expect(totalCount).toEqual(folders.length);
    //         expect(data).toHaveLength(folders.length);
    //         folders.forEach((folder, idx) => {
    //           expectPackedItem(sortedData[idx], folder);
    //           expect(() => expectPackedItem(sortedData[idx], notAFolder)).toThrow(Error);
    //         });
    //       });

    //       it('Throws for wrong sort by', async () => {
    //         await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { type: ItemType.DOCUMENT },
    //         });
    //         await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { type: ItemType.FOLDER },
    //         });
    //         await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { type: ItemType.APP },
    //         });

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/accessible`,
    //           query: {
    //             sortBy: 'nimp',
    //             ordering: Ordering.DESC,
    //           },
    //         });

    //         expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    //       });

    //       it('Throws for wrong ordering', async () => {
    //         await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { type: ItemType.DOCUMENT },
    //         });
    //         await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { type: ItemType.FOLDER },
    //         });
    //         await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { type: ItemType.APP },
    //         });

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/accessible`,
    //           query: {
    //             sortBy: SortBy.ItemName,
    //             ordering: 'nimp',
    //           },
    //         });

    //         expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    //       });

    //       it('Throws for wrong item types', async () => {
    //         await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { type: ItemType.DOCUMENT },
    //         });
    //         await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { type: ItemType.FOLDER },
    //         });
    //         await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { type: ItemType.APP },
    //         });

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/accessible`,
    //           query: {
    //             types: 'nimp',
    //           },
    //         });

    //         expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    //       });

    //       it('Returns successfully paginated items', async () => {
    //         await testUtils.saveItemAndMembership({ member: actor, item: { name: '2' } });
    //         await testUtils.saveItemAndMembership({ member: actor, item: { name: '1' } });
    //         const { packedItem } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { name: '3' },
    //         });

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           // add sorting for result to be less flacky
    //           url: `/items/accessible?ordering=asc&sortBy=${SortBy.ItemName}&pageSize=1&page=3`,
    //         });

    //         expect(response.statusCode).toBe(StatusCodes.OK);

    //         const { data, totalCount } = response.json();
    //         expect(totalCount).toEqual(3);
    //         expect(data).toHaveLength(1);
    //         expectPackedItem(data[0], packedItem);
    //       });
    //     });
    //   });
    //   describe('GET /items/:id/children', () => {
    //     // warning: this will change if the endpoint becomes public
    //     it('Throws if signed out', async () => {
    //       const member = await saveMember();
    //       const { item } = await testUtils.saveItemAndMembership({ member });

    //       const response = await app.inject({
    //         method: HttpMethod.Get,
    //         url: `/items/${item.id}/children`,
    //       });

    //       expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    //     });

    //     describe('Signed In', () => {
    //       beforeEach(async () => {
    //         actor = await saveMember();
    //         mockAuthenticate(actor);
    //       });

    //       it('Returns successfully', async () => {
    //         const { item: parentItem } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //         });
    //         const { packedItem: child1, item: parentItem1 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           parentItem,
    //         });
    //         const { packedItem: child2 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           parentItem,
    //         });

    //         const children = [child1, child2];
    //         // create child of child
    //         await testUtils.saveItemAndMembership({ member: actor, parentItem: parentItem1 });

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/${parentItem.id}/children`,
    //         });

    //         const data = response.json<PackedItem[]>();
    //         expect(data).toHaveLength(children.length);
    //         expectManyPackedItems(data, children);
    //         expect(response.statusCode).toBe(StatusCodes.OK);
    //         data.forEach((i) => expectThumbnails(i, MOCK_SIGNED_URL, false));
    //       });

    //       it('Returns successfully with thumbnails', async () => {
    //         const { item: parentItem } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { settings: { hasThumbnail: true } },
    //         });
    //         const { packedItem: child1, item: parentItem1 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           parentItem,
    //           item: { settings: { hasThumbnail: true } },
    //         });
    //         const { packedItem: child2 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           parentItem,
    //           item: { settings: { hasThumbnail: true } },
    //         });

    //         const children = [child1, child2];
    //         // create child of child
    //         await testUtils.saveItemAndMembership({ member: actor, parentItem: parentItem1 });

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/${parentItem.id}/children`,
    //         });

    //         const data = response.json<PackedItem[]>();
    //         expect(data).toHaveLength(children.length);
    //         expectManyPackedItems(data, children);
    //         expect(response.statusCode).toBe(StatusCodes.OK);
    //         data.forEach((i) => expectThumbnails(i, MOCK_SIGNED_URL, true));
    //       });

    //       it('Filter out hidden children on read permission', async () => {
    //         const member = await saveMember();
    //         const { item: parent } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           creator: member,
    //           permission: PermissionLevel.Read,
    //         });
    //         const { item: child1 } = await testUtils.saveItemAndMembership({
    //           item: { name: 'child1' },
    //           member,
    //           parentItem: parent,
    //         });
    //         const { item: child2 } = await testUtils.saveItemAndMembership({
    //           item: { name: 'child2' },
    //           member,
    //           parentItem: parent,
    //         });
    //         await rawRepository.save({ item: child1, creator: actor, type: ItemVisibilityType.Hidden });

    //         const children = [child2];

    //         // create child of child that shouldn't be returned
    //         await testUtils.saveItemAndMembership({ member: actor, parentItem: child1 });

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/${parent.id}/children?ordered=true`,
    //         });

    //         expect(response.statusCode).toBe(StatusCodes.OK);
    //         const data = response.json();
    //         expect(data).toHaveLength(children.length);
    //         children.forEach(({ id }) => {
    //           expectPackedItem(
    //             data.find(({ id: thisId }) => thisId === id),
    //             // cannot use packed item because membership is saved on member != actor
    //             {
    //               ...children.find(({ id: thisId }) => thisId === id),
    //               permission: PermissionLevel.Read,
    //             },
    //           );
    //         });
    //         expect(response.statusCode).toBe(StatusCodes.OK);
    //       });
    //       it('Filter children by Folder', async () => {
    //         const member = await saveMember();
    //         const { item: parent } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           creator: member,
    //           permission: PermissionLevel.Read,
    //         });
    //         const { packedItem: notAFolder } = await testUtils.saveItemAndMembership({
    //           item: { name: 'child1', type: ItemType.DOCUMENT },
    //           member,
    //           parentItem: parent,
    //         });
    //         const { item: child2 } = await testUtils.saveItemAndMembership({
    //           item: { name: 'child2', type: ItemType.FOLDER },
    //           member,
    //           parentItem: parent,
    //         });
    //         const children = [child2];

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/${parent.id}/children?types=folder`,
    //         });

    //         expect(response.statusCode).toBe(StatusCodes.OK);
    //         const data = response.json();
    //         expect(data).toHaveLength(children.length);
    //         children.forEach(({ id }, idx) => {
    //           expectPackedItem(
    //             data.find(({ id: thisId }) => thisId === id),
    //             // cannot use packed item because member != actor
    //             {
    //               ...children.find(({ id: thisId }) => thisId === id),
    //               permission: PermissionLevel.Read,
    //             },
    //           );
    //           expect(() => expectPackedItem(data[idx], notAFolder)).toThrow(Error);
    //         });
    //         expect(response.statusCode).toBe(StatusCodes.OK);
    //       });

    //       it('Returns successfully children with search', async () => {
    //         const member = await saveMember();
    //         const { item: parent } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           creator: member,
    //           permission: PermissionLevel.Read,
    //         });
    //         const { packedItem: item1 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { name: 'dog' },
    //           parentItem: parent,
    //         });
    //         const { packedItem: item2 } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { name: 'dog' },
    //           parentItem: parent,
    //         });
    //         await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { name: 'cat' },
    //           parentItem: parent,
    //         });
    //         // noise
    //         await testUtils.saveItemAndMembership({
    //           member,
    //           item: { name: 'dog' },
    //         });

    //         const items = [item1, item2];

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/${parent.id}/children`,
    //           query: { keywords: ['dogs'] },
    //         });

    //         expect(response.statusCode).toBe(StatusCodes.OK);

    //         const data = response.json();
    //         expect(data).toHaveLength(items.length);
    //         expectManyPackedItems(data, items);
    //       });

    //       it('Bad Request for invalid id', async () => {
    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: '/items/invalid-id/children',
    //         });

    //         expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
    //         expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    //       });
    //       it('Cannot get children from unexisting item', async () => {
    //         const id = uuidv4();
    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/${id}/children`,
    //         });

    //         expect(response.json()).toEqual(new ItemNotFound(id));
    //         expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    //       });
    //       it('Cannot get children if does not have membership on parent', async () => {
    //         const member = await saveMember();
    //         const { item: parent } = await testUtils.saveItemAndMembership({ member });
    //         await testUtils.saveItemAndMembership({
    //           item: { name: 'child1' },
    //           member,
    //           parentItem: parent,
    //         });
    //         await testUtils.saveItemAndMembership({
    //           item: { name: 'child2' },
    //           member,
    //           parentItem: parent,
    //         });

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/${parent.id}/children`,
    //         });

    //         expect(response.json()).toEqual(new MemberCannotAccess(parent.id));
    //         expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    //       });
    //     });

    //     describe('Public', () => {
    //       it('Returns successfully', async () => {
    //         const actor = await saveMember();
    //         const { item: parent, publicVisibility } = await testUtils.savePublicItem({
    //           member: actor,
    //         });
    //         const { item: child1 } = await testUtils.savePublicItem({
    //           member: actor,
    //           parentItem: parent,
    //         });
    //         const { item: child2 } = await testUtils.savePublicItem({
    //           member: actor,
    //           parentItem: parent,
    //         });

    //         const children = [child1, child2];
    //         // create child of child
    //         await testUtils.savePublicItem({ member: actor, parentItem: child1 });

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/${parent.id}/children`,
    //         });

    //         const data = response.json();
    //         expect(data).toHaveLength(children.length);
    //         children.forEach(({ id }) => {
    //           expectPackedItem(
    //             data.find(({ id: thisId }) => thisId === id),
    //             { ...children.find(({ id: thisId }) => thisId === id), permission: null },
    //             actor,
    //             undefined,
    //             // inheritance
    //             [publicVisibility],
    //           );
    //         });
    //         expect(response.statusCode).toBe(StatusCodes.OK);
    //       });
    //     });
    //   });

    //   describe('GET /items/:id/descendants', () => {
    //     // warning: this will change if the endpoint becomes public
    //     it('Throws if signed out', async () => {
    //       const member = await saveMember();
    //       const { item } = await testUtils.saveItemAndMembership({ member });

    //       const response = await app.inject({
    //         method: HttpMethod.Get,
    //         url: `/items/${item.id}/descendants`,
    //       });

    //       expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    //     });

    //     describe('Signed In', () => {
    //       beforeEach(async () => {
    //         actor = await saveMember();
    //         mockAuthenticate(actor);
    //       });

    //       it('Returns successfully', async () => {
    //         const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });
    //         const { packedItem: child1, item: parentItem1 } = await testUtils.saveItemAndMembership({
    //           item: { name: 'child1' },
    //           member: actor,
    //           parentItem: parent,
    //         });
    //         const { packedItem: child2 } = await testUtils.saveItemAndMembership({
    //           item: { name: 'child2' },
    //           member: actor,
    //           parentItem: parent,
    //         });

    //         const { packedItem: childOfChild } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           parentItem: parentItem1,
    //         });
    //         const descendants = [child1, child2, childOfChild];

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/${parent.id}/descendants`,
    //         });

    //         const data = response.json<PackedItem[]>();
    //         expect(data).toHaveLength(descendants.length);
    //         expectManyPackedItems(data, descendants);
    //         expect(response.statusCode).toBe(StatusCodes.OK);
    //         data.forEach((i) => expectThumbnails(i, MOCK_SIGNED_URL, false));
    //       });
    //       it('Returns successfully with thumbnails', async () => {
    //         const { item: parent } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { settings: { hasThumbnail: true } },
    //         });
    //         const { packedItem: child1, item: parentItem1 } = await testUtils.saveItemAndMembership({
    //           item: { name: 'child1', settings: { hasThumbnail: true } },
    //           member: actor,
    //           parentItem: parent,
    //         });
    //         const { packedItem: child2 } = await testUtils.saveItemAndMembership({
    //           item: { name: 'child2', settings: { hasThumbnail: true } },
    //           member: actor,
    //           parentItem: parent,
    //         });

    //         const { packedItem: childOfChild } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           parentItem: parentItem1,
    //           item: { settings: { hasThumbnail: true } },
    //         });
    //         const descendants = [child1, child2, childOfChild];

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/${parent.id}/descendants`,
    //         });

    //         const data = response.json<PackedItem[]>();
    //         expect(data).toHaveLength(descendants.length);
    //         expectManyPackedItems(data, descendants);
    //         expect(response.statusCode).toBe(StatusCodes.OK);
    //         data.forEach((i) => expectThumbnails(i, MOCK_SIGNED_URL, true));
    //       });
    //       it('Filter out hidden items for read rights', async () => {
    //         const member = await saveMember();
    //         const { item: parent } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           creator: member,
    //           permission: PermissionLevel.Read,
    //         });
    //         const { item: child1 } = await testUtils.saveItemAndMembership({
    //           item: { name: 'child1' },
    //           member,
    //           parentItem: parent,
    //         });
    //         const { item: child2 } = await testUtils.saveItemAndMembership({
    //           item: { name: 'child2' },
    //           member,
    //           parentItem: parent,
    //         });
    //         await rawRepository.save({
    //           item: child1,
    //           creator: member,
    //           type: ItemVisibilityType.Hidden,
    //         });

    //         await testUtils.saveItemAndMembership({
    //           member,
    //           parentItem: child1,
    //         });
    //         const descendants = [child2];

    //         // another item with child
    //         const { item: parent1 } = await testUtils.saveItemAndMembership({ member: actor });
    //         await testUtils.saveItemAndMembership({
    //           item: { name: 'child' },
    //           member: actor,
    //           parentItem: parent1,
    //         });

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/${parent.id}/descendants`,
    //         });

    //         const result = response.json();
    //         // cannot use packed item because member != actor
    //         expectPackedItem(result[0], { ...descendants[0], permission: PermissionLevel.Read });
    //         expect(response.statusCode).toBe(StatusCodes.OK);
    //       });

    //       it('Bad Request for invalid id', async () => {
    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: '/items/invalid-id/descendants',
    //         });

    //         expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
    //         expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    //       });
    //       it('Cannot get descendants from unexisting item', async () => {
    //         const id = uuidv4();
    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/${id}/descendants`,
    //         });

    //         expect(response.json()).toEqual(new ItemNotFound(id));
    //         expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    //       });
    //       it('Cannot get descendants if does not have membership on parent', async () => {
    //         const member = await saveMember();
    //         const { item: parent } = await testUtils.saveItemAndMembership({ member });
    //         await testUtils.saveItemAndMembership({
    //           item: { name: 'child1' },
    //           member,
    //           parentItem: parent,
    //         });
    //         await testUtils.saveItemAndMembership({
    //           item: { name: 'child2' },
    //           member,
    //           parentItem: parent,
    //         });

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/${parent.id}/descendants`,
    //         });

    //         expect(response.json()).toEqual(new MemberCannotAccess(parent.id));
    //         expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    //       });
    //     });

    //     describe('Public', () => {
    //       it('Returns successfully', async () => {
    //         const actor = await saveMember();
    //         const { item: parent, publicVisibility } = await testUtils.savePublicItem({
    //           member: actor,
    //         });
    //         const { item: child1 } = await testUtils.savePublicItem({
    //           item: { name: 'child1' },
    //           member: actor,
    //           parentItem: parent,
    //         });
    //         const { item: child2 } = await testUtils.savePublicItem({
    //           item: { name: 'child2' },
    //           member: actor,
    //           parentItem: parent,
    //         });

    //         const { item: childOfChild } = await testUtils.savePublicItem({
    //           item: { name: 'child3' },
    //           member: actor,
    //           parentItem: child1,
    //         });
    //         const descendants = [child1, child2, childOfChild];

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/${parent.id}/descendants`,
    //         });

    //         const data = response.json();
    //         expect(data).toHaveLength(descendants.length);
    //         descendants.forEach(({ id }) => {
    //           expectPackedItem(
    //             data.find(({ id: thisId }) => thisId === id),
    //             { ...descendants.find(({ id: thisId }) => thisId === id), permission: null },
    //             actor,
    //             undefined,
    //             // inheritance
    //             [publicVisibility],
    //           );
    //         });
    //         expect(response.statusCode).toBe(StatusCodes.OK);
    //       });
    //     });
    //   });

    //   describe('GET /items/:id/parents', () => {
    //     it('Throws if signed out and item is private', async () => {
    //       const member = await saveMember();
    //       const { item } = await testUtils.saveItemAndMembership({ member });

    //       const response = await app.inject({
    //         method: HttpMethod.Get,
    //         url: `/items/${item.id}/parents`,
    //       });

    //       expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    //     });

    //     describe('Signed In', () => {
    //       beforeEach(async () => {
    //         actor = await saveMember();
    //         mockAuthenticate(actor);
    //       });

    //       it('Returns successfully in order', async () => {
    //         const { packedItem: parent, item: parentItem } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //         });
    //         const { packedItem: child1, item: parentItem1 } = await testUtils.saveItemAndMembership({
    //           item: { name: 'child1' },
    //           member: actor,
    //           parentItem,
    //         });
    //         // noise
    //         await testUtils.saveItemAndMembership({
    //           item: { name: 'child2' },
    //           member: actor,
    //           parentItem,
    //         });

    //         const { item: childOfChild } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           parentItem: parentItem1,
    //         });
    //         const parents = [parent, child1];

    //         // patch item to force reorder
    //         await testUtils.itemRepository.updateOne(app.db, parent.id, { name: 'newname' });
    //         parent.name = 'newname';

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/${childOfChild.id}/parents`,
    //         });

    //         const data = response.json<PackedItem[]>();
    //         expect(data).toHaveLength(parents.length);
    //         data.forEach((p, idx) => {
    //           expectPackedItem(p, parents[idx]);
    //           expectThumbnails(p, MOCK_SIGNED_URL, false);
    //         });
    //         expect(response.statusCode).toBe(StatusCodes.OK);
    //       });

    //       it('Returns successfully with thumbnails', async () => {
    //         const { packedItem: parent, item: parentItem } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           item: { settings: { hasThumbnail: true } },
    //         });
    //         const { packedItem: child1, item: parentItem1 } = await testUtils.saveItemAndMembership({
    //           item: { name: 'child1', settings: { hasThumbnail: true } },
    //           member: actor,
    //           parentItem,
    //         });

    //         const { item: childOfChild } = await testUtils.saveItemAndMembership({
    //           member: actor,
    //           parentItem: parentItem1,
    //           item: { settings: { hasThumbnail: true } },
    //         });
    //         const parents = [parent, child1];

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/${childOfChild.id}/parents`,
    //         });

    //         const data = response.json<PackedItem[]>();
    //         expect(data).toHaveLength(parents.length);
    //         data.forEach((p, idx) => {
    //           expectPackedItem(p, parents[idx]);
    //           expectThumbnails(p, MOCK_SIGNED_URL, true);
    //         });
    //         expect(response.statusCode).toBe(StatusCodes.OK);
    //       });
    //       it('Bad Request for invalid id', async () => {
    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: '/items/invalid-id/parents',
    //         });

    //         expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
    //         expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    //       });
    //       it('Cannot get parents from unexisting item', async () => {
    //         const id = uuidv4();
    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/${id}/parents`,
    //         });

    //         expect(response.json()).toEqual(new ItemNotFound(id));
    //         expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    //       });
    //       it('Cannot get parents if does not have membership on parent', async () => {
    //         const member = await saveMember();
    //         const { item: parent } = await testUtils.saveItemAndMembership({ member });
    //         await testUtils.saveItemAndMembership({
    //           item: { name: 'child1' },
    //           member,
    //           parentItem: parent,
    //         });
    //         await testUtils.saveItemAndMembership({
    //           item: { name: 'child2' },
    //           member,
    //           parentItem: parent,
    //         });

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/${parent.id}/parents`,
    //         });

    //         expect(response.json()).toEqual(new MemberCannotAccess(parent.id));
    //         expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    //       });
    //     });

    //     describe('Public', () => {
    //       it('Returns successfully', async () => {
    //         const { item: parent, publicVisibility } = await testUtils.savePublicItem({ member: null });
    //         const { item: child1 } = await testUtils.savePublicItem({
    //           item: { name: 'child1' },
    //           member: null,
    //           parentItem: parent,
    //         });

    //         const { item: childOfChild } = await testUtils.savePublicItem({
    //           item: { name: 'child3' },
    //           member: null,
    //           parentItem: child1,
    //         });

    //         // noise
    //         await testUtils.savePublicItem({
    //           item: { name: 'child2' },
    //           member: null,
    //           parentItem: parent,
    //         });

    //         const parents = [parent, child1];

    //         const response = await app.inject({
    //           method: HttpMethod.Get,
    //           url: `/items/${childOfChild.id}/parents`,
    //         });

    //         const data = response.json();
    //         expect(data).toHaveLength(parents.length);
    //         data.forEach((p, idx) => {
    //           expectPackedItem(p, { ...parents[idx], permission: null }, undefined, undefined, [
    //             publicVisibility,
    //           ]);
    //         });
    //         expect(response.statusCode).toBe(StatusCodes.OK);
    //       });
    //     });
  });
});
