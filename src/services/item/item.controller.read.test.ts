import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { v4 as uuidv4 } from 'uuid';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../test/app';
import { seedFromJson } from '../../../test/mocks/seed';
import { db } from '../../drizzle/db';
import { assertIsDefined } from '../../utils/assertions';
import { ItemNotFound, MemberCannotAccess } from '../../utils/errors';
import { assertIsMemberForTest } from '../authentication';
import { ItemWrapper, type PackedItem } from './ItemWrapper';
import { expectManyPackedItems, expectPackedItem, expectThumbnails } from './test/fixtures/items';
import { Ordering, SortBy } from './types';

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

export const expectParents = (
  data: { name: string; id: string; path: string }[],
  parents: { name: string; id: string; path: string }[],
) => {
  expect(data).toHaveLength(parents.length);

  for (let i = 0; i < parents.length; i++) {
    expect(data[i].id).toEqual(parents[i].id);
    expect(data[i].name).toEqual(parents[i].name);
    expect(data[i].path).toEqual(parents[i].path);
  }
};

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

  describe('GET /api/items/:id', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{}] });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/items/${item.id}`,
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
          url: `/api/items/${item.id}`,
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
          url: `/api/items/${item.id}`,
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
          url: `/api/items/${item.id}`,
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
          url: '/api/items/invalid-id',
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
          url: `/api/items/${item.id}`,
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
          url: `/api/items/${item.id}`,
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
          url: `/api/items/${item.id}`,
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

  describe('GET /items/accessible', () => {
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/api/items/accessible',
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Returns successfully owned and shared items', async () => {
        const {
          actor,
          members: [member],
          items: [parentItem1, _child1, item2, item3, parentItem4, _child4, _parentItem5, item6],
          itemMemberships: [im1, im2, im3, im4, im6],
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
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/api/items/accessible',
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const { data } = response.json<{ data: PackedItem[] }>();

        const ims = [im1, im2, im3, im4, im6];
        const packedItems = [parentItem1, item2, item3, parentItem4, item6].map((i) => {
          const creator = i.creatorId === actor.id ? actor : member;

          return new ItemWrapper(
            { ...i, creator },
            ims.find((im) => i.path.includes(im.itemPath)),
          ).packed();
        });

        expect(data).toHaveLength(packedItems.length);

        expectManyPackedItems(data, packedItems);

        data.forEach((i) => expectThumbnails(i, MOCK_SIGNED_URL, false));
      });

      it('Returns items, some with thumbnails', async () => {
        const {
          actor,
          items: [_item1, item2, _item3, _item4, item5],
        } = await seedFromJson({
          items: [
            // own items
            {
              creator: 'actor',
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              creator: 'actor',
              settings: { hasThumbnail: true },
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              creator: 'actor',
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            // shared items
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [
                {
                  creator: { name: 'bob' },
                  settings: { hasThumbnail: true },
                  memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
                },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const itemsWithThumbnails = [item2, item5];

        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/api/items/accessible',
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const { data } = response.json<{ data: PackedItem[] }>();

        data.forEach((i) => {
          expectThumbnails(
            i,
            MOCK_SIGNED_URL,
            Boolean(itemsWithThumbnails.find((item) => item.id === i.id)),
          );
        });
      });

      it('Returns successfully items for member id', async () => {
        const {
          actor,
          members: [bob],
          items: [item1, item2],
        } = await seedFromJson({
          items: [
            {
              creator: { name: 'bob' },
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              creator: { name: 'bob' },
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            // noise
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
          url: `/api/items/accessible?creatorId=${bob.id}`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const packedItems = [item1, item2].map((i) =>
          new ItemWrapper({ ...i, creator: bob }, { permission: PermissionLevel.Admin }).packed(),
        );
        const { data } = response.json();
        expect(data).toHaveLength(packedItems.length);
        expectManyPackedItems(data, packedItems);
      });

      it('Returns successfully sorted items by name asc', async () => {
        const {
          actor,
          items: [item1, item2, item3],
        } = await seedFromJson({
          items: [
            {
              name: '2',
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              name: '3',
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              name: '1',
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/accessible?sortBy=${SortBy.ItemName}&ordering=asc`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);

        const packedItems = [item3, item1, item2].map((i) =>
          new ItemWrapper({ ...i, creator: actor }, { permission: PermissionLevel.Admin }).packed(),
        );
        const { data } = response.json();
        expect(data).toHaveLength(packedItems.length);
        expectManyPackedItems(data, packedItems);
        // check order
        packedItems.forEach((i, idx) => expect(data[idx].id).toEqual(i.id));
      });

      it('Returns successfully sorted items by type desc', async () => {
        const {
          actor,
          items: [item1, item2, item3],
        } = await seedFromJson({
          items: [
            {
              type: ItemType.DOCUMENT,
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              type: ItemType.FOLDER,
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              type: ItemType.APP,
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/accessible?sortBy=${SortBy.ItemType}&ordering=desc`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const packedItems = [item2, item1, item3].map((i) =>
          new ItemWrapper({ ...i, creator: actor }, { permission: PermissionLevel.Admin }).packed(),
        );
        const { data } = response.json();
        expect(data).toHaveLength(packedItems.length);
        expectManyPackedItems(data, packedItems);
        // check order
        packedItems.forEach((i, idx) => expect(data[idx].id).toEqual(i.id));
      });

      it('Returns successfully sorted items by creator name asc', async () => {
        const {
          actor,
          items: [item1, item2, item3],
        } = await seedFromJson({
          items: [
            {
              creator: { name: 'bob' },
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              creator: { name: 'anna' },
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              creator: { name: 'cedric' },
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/accessible?sortBy=${SortBy.ItemCreatorName}&ordering=asc`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const packedItems = [item2, item1, item3].map((i) =>
          new ItemWrapper({ ...i, creator: actor }, { permission: PermissionLevel.Admin }).packed(),
        );
        const { data } = response.json();
        expect(data).toHaveLength(packedItems.length);
        expectManyPackedItems(data, packedItems);
        // check order
        packedItems.forEach((i, idx) => expect(data[idx].id).toEqual(i.id));
      });

      it('Returns successfully items for search', async () => {
        const {
          actor,
          items: [item1, item2],
        } = await seedFromJson({
          items: [
            {
              name: 'dog',
              creator: { name: 'bob' },
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              name: 'dog',
              creator: { name: 'anna' },
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              name: 'cat',
              creator: { name: 'cedric' },
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              name: 'dog',
              creator: { name: 'cedric' },
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/api/items/accessible',
          query: { keywords: ['dogs'] },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const { data } = response.json();
        expect(data).toHaveLength(2);
        expectManyPackedItems(
          data,
          [item1, item2].map((i) => ({ ...i, permission: PermissionLevel.Admin })),
        );
      });

      it('Returns successfully items by read', async () => {
        const {
          actor,
          items: [item1],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
            },
            // noise
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/api/items/accessible',
          query: {
            sortBy: SortBy.ItemCreatorName,
            ordering: 'asc',
            permissions: [PermissionLevel.Read],
          },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const { data } = response.json();
        expect(data).toHaveLength(1);
        expect(data[0].id).toEqual(item1.id);
      });

      it('Returns successfully items by write and admin', async () => {
        const {
          actor,
          items: [_noise, item2, item3],
        } = await seedFromJson({
          items: [
            {
              name: 'noise',
              memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
            },
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/api/items/accessible',
          query: {
            permissions: [PermissionLevel.Write, PermissionLevel.Admin],
          },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const items = [item2, item3];
        const { data } = response.json();
        expect(data).toHaveLength(items.length);
      });

      it('Returns successfully folder items', async () => {
        const {
          actor,
          items: [item1, item2],
        } = await seedFromJson({
          items: [
            {
              type: ItemType.FOLDER,
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              type: ItemType.FOLDER,
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            // noise
            {
              type: ItemType.APP,
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const sortByName = (a, b) => a.name.localeCompare(b.name);

        const folders = [item1, item2]
          .map((i) =>
            new ItemWrapper(
              { ...i, creator: actor },
              { permission: PermissionLevel.Admin },
            ).packed(),
          )
          .sort(sortByName);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/api/items/accessible',
          query: {
            types: [ItemType.FOLDER],
          },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const { data } = response.json();
        const sortedData = data.sort(sortByName);
        expect(data).toHaveLength(folders.length);
        folders.forEach((folder, idx) => {
          expectPackedItem(sortedData[idx], folder);
        });
      });

      it('Throws for wrong sort by', async () => {
        const { actor } = await seedFromJson({
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
          url: '/api/items/accessible',
          query: {
            sortBy: 'nimp',
            ordering: Ordering.DESC,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws for wrong ordering', async () => {
        const { actor } = await seedFromJson({
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
          url: '/api/items/accessible',
          query: {
            sortBy: SortBy.ItemName,
            ordering: 'nimp',
          },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws for wrong item types', async () => {
        const { actor } = await seedFromJson({
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
          url: '/api/items/accessible',
          query: {
            types: 'nimp',
          },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Returns successfully paginated items', async () => {
        const {
          actor,
          items: [_item1, _item2, item3],
        } = await seedFromJson({
          items: [
            {
              name: '2',
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            { name: '1', memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] },
            { name: '3', memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          // add sorting for result to be less flacky
          url: `/api/items/accessible?ordering=asc&sortBy=${SortBy.ItemName}&pageSize=1&page=3`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const { data } = response.json();
        expect(data).toHaveLength(1);
        expect(data[0].id).toEqual(item3.id);
      });
    });
  });
  describe('GET /items/:id/children', () => {
    // warning: this will change if the endpoint becomes public
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{ children: [{}] }] });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/items/${item.id}/children`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    describe('Signed In', () => {
      it('Returns successfully', async () => {
        const {
          actor,
          items: [parentItem, child1, child2],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [
                {},
                {
                  // noise child
                  children: [{}],
                },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${parentItem.id}/children`,
        });

        const data = response.json<PackedItem[]>();
        const children = [child1, child2].map((i) =>
          new ItemWrapper({ ...i, creator: actor }, { permission: PermissionLevel.Admin }).packed(),
        );
        expect(data).toHaveLength(children.length);
        expectManyPackedItems(data, children);
        expect(response.statusCode).toBe(StatusCodes.OK);
        data.forEach((i) => expectThumbnails(i, MOCK_SIGNED_URL, false));
      });

      it('Returns successfully with thumbnails', async () => {
        const {
          actor,
          items: [parentItem, child1, child2],
        } = await seedFromJson({
          items: [
            {
              settings: { hasThumbnail: true },
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [
                { settings: { hasThumbnail: true } },
                { settings: { hasThumbnail: true }, children: [{ name: 'noise' }] },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const children = [child1, child2].map((i) =>
          new ItemWrapper({ ...i, creator: actor }, { permission: PermissionLevel.Admin }).packed(),
        );

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${parentItem.id}/children`,
        });

        const data = response.json<PackedItem[]>();
        expect(data).toHaveLength(children.length);
        expectManyPackedItems(data, children);
        expect(response.statusCode).toBe(StatusCodes.OK);
        data.forEach((i) => expectThumbnails(i, MOCK_SIGNED_URL, true));
      });

      it('Filter out hidden children on read permission', async () => {
        const {
          actor,
          items: [parent, _hidden, child2],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
              children: [{ isHidden: true }, { children: [{ name: 'noise' }] }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${parent.id}/children`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const data = response.json();
        expect(data).toHaveLength(1);
        expectPackedItem(
          data[0],
          new ItemWrapper(
            { ...child2, creator: null },
            {
              permission: PermissionLevel.Read,
            },
          ).packed(),
        );
        expect(response.statusCode).toBe(StatusCodes.OK);
      });

      it('Filter children by Folder', async () => {
        const {
          actor,
          items: [parent, _notAFolder, child2, child3],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [
                { type: ItemType.DOCUMENT },
                { type: ItemType.FOLDER },
                { type: ItemType.FOLDER, children: [{ name: 'noise' }] },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${parent.id}/children?types=folder`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const children = [child2, child3].map((i) =>
          new ItemWrapper({ ...i, creator: null }, { permission: PermissionLevel.Admin }).packed(),
        );
        const data = response.json();
        expect(data).toHaveLength(children.length);
        expectManyPackedItems(data, children);
        expect(response.statusCode).toBe(StatusCodes.OK);
      });

      it('Returns successfully children with search', async () => {
        const {
          actor,
          items: [parent, item1, item2],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [
                {
                  name: 'dog',
                  creator: { name: 'bob' },
                },
                {
                  name: 'dog',
                  creator: { name: 'anna' },
                },
                {
                  name: 'cat',
                  creator: { name: 'cedric' },
                },
              ],
            },
            {
              name: 'dog',
              creator: { name: 'cedric' },
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${parent.id}/children`,
          query: { keywords: ['dogs'] },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const data = response.json();
        expect(data).toHaveLength(2);
        expectManyPackedItems(
          data,
          [item1, item2].map((i) => ({ ...i, permission: PermissionLevel.Admin })),
        );
      });

      it('Bad Request for invalid id', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/api/items/invalid-id/children',
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Cannot get children from unexisting item', async () => {
        const id = uuidv4();
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${id}/children`,
        });

        expect(response.json().message).toEqual(new ItemNotFound(id).message);
        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      });
      it('Cannot get children if does not have membership on parent', async () => {
        const {
          items: [parent],
        } = await seedFromJson({ items: [{ children: [{}, {}] }] });

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${parent.id}/children`,
        });

        expect(response.json()).toEqual(new MemberCannotAccess(parent.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });

    describe('Public', () => {
      it('Returns successfully', async () => {
        const {
          actor,
          items: [parent, child1, child2, child3],
          itemVisibilities,
        } = await seedFromJson({
          items: [
            {
              creator: 'actor',
              isPublic: true,
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [
                {
                  creator: 'actor',
                  type: ItemType.DOCUMENT,
                },
                {
                  creator: 'actor',
                  type: ItemType.FOLDER,
                },
                {
                  creator: 'actor',
                  type: ItemType.FOLDER,
                  children: [{ name: 'noise' }],
                },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${parent.id}/children`,
        });

        const children = [child1, child2, child3].map((i) =>
          new ItemWrapper(
            { ...i, creator: actor },
            { permission: PermissionLevel.Admin },
            itemVisibilities,
          ).packed(),
        );
        const data = response.json();
        expect(data).toHaveLength(children.length);
        expectManyPackedItems(data, children);
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
    });
  });

  describe('GET /items/:id/descendants', () => {
    // warning: this will change if the endpoint becomes public
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{}] });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/items/${item.id}/descendants`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    describe('Signed In', () => {
      it('Returns successfully', async () => {
        const {
          actor,
          items: [parent, child1, child2, childOfChild],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [{ children: [{}] }, {}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const descendants = [child1, child2, childOfChild].map((i) =>
          new ItemWrapper({ ...i, creator: null }, { permission: PermissionLevel.Admin }).packed(),
        );

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${parent.id}/descendants`,
        });

        const data = response.json<PackedItem[]>();
        expect(data).toHaveLength(descendants.length);
        expectManyPackedItems(data, descendants);
        expect(response.statusCode).toBe(StatusCodes.OK);
        data.forEach((i) => expectThumbnails(i, MOCK_SIGNED_URL, false));
      });
      it('Returns successfully with thumbnails', async () => {
        const {
          actor,
          items: [parent, child1, child2, childOfChild],
        } = await seedFromJson({
          items: [
            {
              settings: { hasThumbnail: true },
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [
                {
                  settings: { hasThumbnail: true },
                  children: [{ settings: { hasThumbnail: true } }],
                },
                { settings: { hasThumbnail: true } },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${parent.id}/descendants`,
        });

        const data = response.json<PackedItem[]>();
        const descendants = [child1, child2, childOfChild].map((i) =>
          new ItemWrapper({ ...i, creator: null }, { permission: PermissionLevel.Admin }).packed(),
        );
        expect(data).toHaveLength(descendants.length);
        expectManyPackedItems(data, descendants);
        expect(response.statusCode).toBe(StatusCodes.OK);
        data.forEach((i) => expectThumbnails(i, MOCK_SIGNED_URL, true));
      });
      it('Filter out hidden items for read rights', async () => {
        const {
          actor,
          items: [parent, _hidden, _hiddenChildOfChild, child2],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
              children: [{ isHidden: true, children: [{}] }, {}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${parent.id}/descendants`,
        });

        const result = response.json();
        expect(result).toHaveLength(1);
        expectPackedItem(
          result[0],
          new ItemWrapper(
            { ...child2, creator: null },
            { permission: PermissionLevel.Read },
          ).packed(),
        );
        expect(response.statusCode).toBe(StatusCodes.OK);
      });

      it('Bad Request for invalid id', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/api/items/invalid-id/descendants',
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Cannot get descendants from unexisting item', async () => {
        const id = uuidv4();
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${id}/descendants`,
        });

        expect(response.json().message).toEqual(new ItemNotFound(id).message);
        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      });
      it('Cannot get descendants if does not have membership on parent', async () => {
        const {
          items: [item],
        } = await seedFromJson({ items: [{ children: [{}, {}] }] });

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${item.id}/descendants`,
        });

        expect(response.json()).toEqual(new MemberCannotAccess(item.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });

    describe('Public', () => {
      it('Returns successfully', async () => {
        const {
          items: [parent, child1, childOfChild, childOfChild2],
        } = await seedFromJson({ items: [{ isPublic: true, children: [{ children: [{}, {}] }] }] });

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${parent.id}/descendants`,
        });

        const data = response.json();
        const descendants = [child1, childOfChild, childOfChild2].map((i) =>
          new ItemWrapper({ ...i, creator: null }).packed(),
        );
        expect(data).toHaveLength(descendants.length);
        expectManyPackedItems(data, descendants);
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
    });
  });

  describe('GET /items/:id/parents', () => {
    it('Throws if signed out and item is private', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{}] });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/items/${item.id}/parents`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    describe('Signed In', () => {
      it('Returns successfully in order', async () => {
        const {
          actor,
          items: [parent, child1, childOfChild],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [{ children: [{}] }],
            },
            {},
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const parents = [parent, child1];

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${childOfChild.id}/parents`,
        });

        const data = response.json();

        expectParents(data, parents);
        expect(response.statusCode).toBe(StatusCodes.OK);
      });

      it('Bad Request for invalid id', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/api/items/invalid-id/parents',
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Cannot get parents from unexisting item', async () => {
        const id = uuidv4();
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${id}/parents`,
        });

        expect(response.json().message).toEqual(new ItemNotFound(id).message);
        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      });
      it('Cannot get parents if does not have membership on parent', async () => {
        const {
          actor,
          items: [parent],
        } = await seedFromJson({
          items: [{}],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${parent.id}/parents`,
        });

        expect(response.json()).toEqual(new MemberCannotAccess(parent.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
      it('Cannot get parents if item is hidden', async () => {
        const {
          actor,
          items: [_parent, child],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
              children: [
                {
                  isHidden: true,
                },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${child.id}/parents`,
        });

        expect(response.json()).toEqual(new MemberCannotAccess(child.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });

    describe('Public', () => {
      it('Returns successfully', async () => {
        const {
          items: [parent, child1, childOfChild],
        } = await seedFromJson({
          actor: null,
          items: [
            {
              name: 'parent',
              isPublic: true,
              children: [{ name: 'secondParent', children: [{ name: 'child' }] }],
            },
            {},
          ],
        });

        const parents = [parent, child1];

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${childOfChild.id}/parents`,
        });

        const data = response.json();
        expect(data).toHaveLength(parents.length);
        expectParents(data, parents);
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
      it('Cannot get parents if item is public and hidden', async () => {
        const {
          items: [_parent, child],
        } = await seedFromJson({
          actor: null,
          items: [
            {
              isPublic: true,
              children: [
                {
                  isHidden: true,
                },
              ],
            },
          ],
        });

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${child.id}/parents`,
        });

        expect(response.json()).toEqual(new MemberCannotAccess(child.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });
});
