import { faker } from '@faker-js/faker';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { asc } from 'drizzle-orm/sql';
import FormData from 'form-data';
import fs from 'fs';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import waitForExpect from 'wait-for-expect';

import type { FastifyInstance } from 'fastify';

import {
  DescriptionPlacement,
  FolderItemFactory,
  HttpMethod,
  ItemType,
  MAX_NUMBER_OF_CHILDREN,
  MAX_TARGETS_FOR_MODIFY_REQUEST,
  MAX_TREE_LEVELS,
  PermissionLevel,
} from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../test/app';
import { MULTIPLE_ITEMS_LOADING_TIME } from '../../../test/constants';
import { type SeedActor, seedFromJson } from '../../../test/mocks/seed';
import { db } from '../../drizzle/db';
import { isDirectChild } from '../../drizzle/operations';
import { itemGeolocationsTable, itemMembershipsTable, itemsRawTable } from '../../drizzle/schema';
import { assertIsDefined } from '../../utils/assertions';
import {
  HierarchyTooDeep,
  ItemNotFolder,
  ItemNotFound,
  MemberCannotAccess,
  MemberCannotWriteItem,
  TooManyChildren,
} from '../../utils/errors';
import { assertIsMemberForTest } from '../authentication';
import { WebsocketService } from '../websockets/ws-service';
import { ItemService } from './item.service';
import { ItemActionService } from './plugins/action/itemAction.service';
import { expectItem } from './test/fixtures/items';
import { getItemWithDepth } from './test/utils';

const getItemOrder = async (item: { id: string }) => {
  const val = await db.query.itemsRawTable.findFirst({
    columns: { order: true },
    where: eq(itemsRawTable.id, item.id),
  });
  if (val) {
    return val.order;
  }
  return undefined;
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

  describe('POST /api/items', () => {
    it('Throws if signed out', async () => {
      const payload = FolderItemFactory();
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Schema validation', () => {
      it('Throw if geolocation is partial', async () => {
        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items',
          payload: { ...payload, geolocation: { lat: 1 } },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);

        const response1 = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items',
          payload: { ...payload, geolocation: { lng: 1 } },
        });

        expect(response1.statusCode).toBe(StatusCodes.BAD_REQUEST);
        // no item nor geolocation is created
        expect(
          await db.query.itemGeolocationsTable.findFirst({
            where: eq(itemGeolocationsTable.itemPath, payload.path),
          }),
        ).toBeUndefined();
      });

      it('Bad request if name is invalid', async () => {
        // by default the item creator use an invalid item type
        const newItem = FolderItemFactory({ name: '' });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items',
          payload: newItem,
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);

        // by default the item creator use an invalid item type
        const newItem1 = FolderItemFactory({ name: ' ' });
        const response1 = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items',
          payload: newItem1,
        });
        expect(response1.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response1.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Bad request if type is invalid', async () => {
        // by default the item creator use an invalid item type
        const newItem = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items',
          payload: { ...newItem, type: 'invalid-type' },
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Bad request if parentId id is invalid', async () => {
        const payload = FolderItemFactory();
        const parentId = 'invalid-id';
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items?parentId=${parentId}`,
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });

    describe('Signed In', () => {
      let waitForPostCreation: () => Promise<unknown>;
      beforeEach(async () => {
        const itemServiceRescaleOrderForParent = jest.spyOn(
          ItemService.prototype,
          'rescaleOrderForParent',
        );
        const itemActionServicePostPostAction = jest.spyOn(
          ItemActionService.prototype,
          'postPostAction',
        );

        // The API's is still working with the database after responding to an item post request,
        // so we need to wait for the work to be done so we don't have flacky deadlock exceptions.
        waitForPostCreation = async () => {
          return await waitForExpect(() => {
            expect(itemServiceRescaleOrderForParent).toHaveBeenCalled();
            expect(itemActionServicePostPostAction).toHaveBeenCalled();
          });
        };
      });

      it('Create successfully', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items',
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        // check response value
        const newItem = response.json();
        expectItem(newItem, payload);
        await waitForPostCreation();

        // check item exists in db
        const item = await db.query.itemsRawTable.findFirst({
          where: eq(itemsRawTable.id, newItem.id),
        });
        expect(item).toBeDefined();
        // order is null for root
        expect(item!.order).toBeNull();

        // a membership is created for this item
        const membership = await await db.query.itemMembershipsTable.findFirst({
          where: eq(itemMembershipsTable.itemPath, newItem.path),
        });
        expect(membership).toBeDefined();
        expect(membership!.permission).toEqual(PermissionLevel.Admin);
      });

      it('Create successfully in parent item', async () => {
        const {
          actor,
          items: [parent, child],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [{ order: 3 }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items?parentId=${parent.id}`,
          payload,
        });
        const newItem = response.json();

        expect(response.statusCode).toBe(StatusCodes.OK);
        expectItem(newItem, payload, actor, parent);
        // add at beginning
        const newItemOrder = await getItemOrder(newItem);
        expect(newItemOrder).toBeLessThan(child.order!);

        // check post logic
        await waitForPostCreation();

        // a membership does not need to be created for item with admin rights
        const newMembership = await db.query.itemMembershipsTable.findFirst({
          where: eq(itemMembershipsTable.itemPath, newItem.path),
        });
        expect(newMembership).toBeUndefined();
      });

      it('Create successfully in shared parent item', async () => {
        const {
          actor,
          items: [parent],
        } = await seedFromJson({
          items: [
            {
              creator: { name: 'bob' },
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items?parentId=${parent.id}`,
          payload,
        });

        const newItem = response.json();
        expectItem(newItem, payload, actor, parent);
        expect(response.statusCode).toBe(StatusCodes.OK);
        await waitForPostCreation();

        // a membership is created for this item
        // one membership for the owner
        // one membership for sharing
        // admin for the new item
        expect(
          await db.query.itemMembershipsTable.findFirst({
            where: eq(itemMembershipsTable.itemPath, newItem.path),
          }),
        ).toBeDefined();
      });

      it('Create successfully with geolocation', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items`,
          payload: { ...payload, geolocation: { lat: 1, lng: 2 } },
        });

        const newItem = response.json();
        expectItem(newItem, payload, actor);
        expect(response.statusCode).toBe(StatusCodes.OK);
        await waitForPostCreation();

        expect(
          await db.query.itemGeolocationsTable.findFirst({
            where: eq(itemGeolocationsTable.itemPath, newItem.path),
          }),
        ).toBeDefined();
      });

      it('Create successfully with language', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory({ lang: 'fr' });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items`,
          payload,
        });

        const newItem = response.json();
        expectItem(newItem, payload, actor);
        expect(response.statusCode).toBe(StatusCodes.OK);
        await waitForPostCreation();
      });

      it('Create successfully with parent language', async () => {
        const lang = 'es';
        const {
          actor,
          items: [parentItem],
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Admin }], lang }],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items`,
          payload: { name: faker.word.adverb(), type: ItemType.FOLDER },
          query: { parentId: parentItem.id },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const newItem = response.json();
        expect(newItem.lang).toEqual(lang);
        await waitForPostCreation();
      });

      it('Create successfully with description placement above and should not erase default thumbnail', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory({
          settings: { descriptionPlacement: DescriptionPlacement.ABOVE },
        });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items`,
          payload,
        });

        const newItem = response.json();
        expectItem(newItem, payload, actor);
        expect(response.statusCode).toBe(StatusCodes.OK);
        await waitForPostCreation();
        expect(newItem.settings.descriptionPlacement).toBe(DescriptionPlacement.ABOVE);
        expect(newItem.settings.hasThumbnail).toBe(false);
      });

      it('Filter out bad setting when creating', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const BAD_SETTING = { INVALID: 'Not a valid setting' };
        const VALID_SETTING = { descriptionPlacement: DescriptionPlacement.ABOVE };

        const payload = FolderItemFactory({
          settings: {
            ...BAD_SETTING,
            ...VALID_SETTING,
          },
        });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items`,
          payload,
        });

        const newItem = response.json();
        expectItem(newItem, { ...payload, settings: VALID_SETTING }, actor);
        expect(response.statusCode).toBe(StatusCodes.OK);
        await waitForPostCreation();
        expect(newItem.settings.descriptionPlacement).toBe(VALID_SETTING.descriptionPlacement);
        expect(Object.keys(newItem.settings)).not.toContain(Object.keys(BAD_SETTING)[0]);
      });

      it('Create successfully with between children', async () => {
        const {
          actor,
          items: [parentItem, previousItem, afterItem],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [{ order: 1 }, { order: 2 }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items`,
          query: { parentId: parentItem.id, previousItemId: previousItem.id },
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);

        const newItem = response.json();
        expectItem(newItem, payload, actor);
        await waitForPostCreation();

        const newItemOrder = await getItemOrder(newItem);
        expect(newItemOrder).toBeGreaterThan(previousItem.order!);
        expect(newItemOrder).toBeLessThan(afterItem.order!);
      });

      it('Create successfully at end', async () => {
        const {
          actor,
          items: [parentItem, _previousItem, lastItem],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [{ order: 1 }, { order: 2 }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items`,
          query: { parentId: parentItem.id, previousItemId: lastItem.id },
          payload,
        });

        const newItem = response.json();
        expectItem(newItem, payload, actor);
        expect(response.statusCode).toBe(StatusCodes.OK);
        await waitForPostCreation();

        const newItemOrder = await getItemOrder(newItem);
        expect(newItemOrder).toBeGreaterThan(lastItem.order!);
      });

      it('Create successfully after invalid child adds at end', async () => {
        const {
          actor,
          items: [parentItem, _previousItem, lastItem, _anotherParent, anotherChild],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [{ order: 1 }, { order: 30 }],
            },
            { children: [{ order: 100 }] },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items`,
          query: { parentId: parentItem.id, previousItemId: anotherChild.id },
          payload,
        });

        const newItem = response.json();
        expectItem(newItem, payload, actor);
        expect(response.statusCode).toBe(StatusCodes.OK);
        await waitForPostCreation();

        // should be after child, since another child is not valid
        const newItemOrder = await getItemOrder(newItem);
        expect(newItemOrder).toBeGreaterThan(lastItem.order!);
        expect(newItemOrder).toBeLessThan(anotherChild.order!);
      });

      it('Cannot create item in non-existing parent', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const parentId = uuidv4();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items?parentId=${parentId}`,
          payload,
        });

        expect(response.statusMessage).toEqual('Not Found');
        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      });

      it('Cannot create item if member does not have membership on parent', async () => {
        const {
          actor,
          items: [parent],
        } = await seedFromJson({ items: [{}] });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items?parentId=${parent.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual(new MemberCannotAccess(parent.id));
      });

      it('Cannot create item if member can only read parent', async () => {
        const {
          actor,
          items: [parent],
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Read }] }],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items?parentId=${parent.id}`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual(new MemberCannotWriteItem(parent.id));
      });

      it('Cannot create item if parent item has too many children', async () => {
        const {
          actor,
          items: [parent],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: Array.from({ length: MAX_NUMBER_OF_CHILDREN }, () => ({})),
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items?parentId=${parent.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual(new TooManyChildren());
      });

      it('Cannot create item if parent is too deep in hierarchy', async () => {
        const { actor, items } = await seedFromJson({
          items: [
            {
              ...getItemWithDepth(MAX_TREE_LEVELS + 1),
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const deepestItem = items.pop()!;
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items?parentId=${deepestItem.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual(new HierarchyTooDeep());
      });

      it('Cannot create inside non-folder item', async () => {
        const {
          actor,
          items: [parent],
        } = await seedFromJson({
          items: [
            {
              type: ItemType.DOCUMENT,
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items?parentId=${parent.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(response.json()).toMatchObject(new ItemNotFolder({ id: parent.id }));
      });
    });
  });

  describe('POST /api/items/with-thumbnail', () => {
    it('Post item with thumbnail', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);
      const imageStream = fs.createReadStream(path.resolve(__dirname, './test/fixtures/image.png'));
      const itemName = 'Test Item';
      const payload = new FormData();
      payload.append('name', itemName);
      payload.append('type', ItemType.FOLDER);
      payload.append('description', '');
      payload.append('file', imageStream);
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/with-thumbnail`,
        payload,
        headers: payload.getHeaders(),
      });

      const newItem = response.json();
      expectItem(
        newItem,
        FolderItemFactory({
          name: itemName,
          type: ItemType.FOLDER,
          description: '',
          settings: { hasThumbnail: true },
          lang: 'en',
        }),
        actor,
      );
      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(uploadDoneMock).toHaveBeenCalled();
    });
  });

  describe('PATCH /api/items/:id', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/api/items/${item.id}`,
        payload: { name: 'new name' },
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    describe('Signed In', () => {
      it('Update successfully', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              type: ItemType.DOCUMENT,
              extra: {
                [ItemType.DOCUMENT]: {
                  content: 'content',
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
          extra: {
            [ItemType.DOCUMENT]: {
              content: 'new content',
            },
          },
          settings: {
            hasThumbnail: true,
          },
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${item.id}`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        // this test a bit how we deal with extra: it replaces existing keys
        expectItem(response.json(), {
          ...item,
          ...payload,
          // BUG: folder extra should not contain extra
          extra: {
            document: {
              ...item.extra[item.type],
              ...payload.extra[item.type],
            },
          },
        });
      });
      it('Update successfully new language', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              lang: 'en',
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = {
          lang: 'fr',
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${item.id}`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        // this test a bit how we deal with extra: it replaces existing keys
        expectItem(response.json(), {
          ...item,
          ...payload,
        });
      });
      it('Update successfully description placement above', async () => {
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

        const payload = {
          settings: {
            ...item.settings,
            descriptionPlacement: DescriptionPlacement.ABOVE,
          },
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${item.id}`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const newItem = response.json();
        // this test a bit how we deal with extra: it replaces existing keys
        expectItem(newItem, {
          ...item,
          ...payload,
        });
        expect(newItem.settings.descriptionPlacement).toBe(DescriptionPlacement.ABOVE);
        expect(newItem.settings.hasThumbnail).toBeFalsy();
      });
      it('Update successfully link settings', async () => {
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

        const payload = {
          settings: {
            showLinkButton: false,
            showLinkIframe: true,
          },
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${item.id}`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const newItem = response.json();
        expectItem(newItem, {
          ...item,
          settings: { ...item.settings, ...payload.settings },
        });
        expect(newItem.settings.showLinkButton).toBe(false);
        expect(newItem.settings.showLinkIframe).toBe(true);
        expect(newItem.settings.hasThumbnail).toBeFalsy();
      });
      it('Filter out bad setting when updating', async () => {
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

        const BAD_SETTING = { INVALID: 'Not a valid setting' };
        const VALID_SETTING = { descriptionPlacement: DescriptionPlacement.ABOVE };
        const payload = {
          settings: {
            ...item.settings,
            ...VALID_SETTING,
            ...BAD_SETTING,
          },
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${item.id}`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const newItem = response.json();
        // this test a bit how we deal with extra: it replaces existing keys
        expectItem(newItem, {
          ...item,
          ...payload,
          settings: VALID_SETTING,
        });
        expect(newItem.settings.descriptionPlacement).toBe(VALID_SETTING.descriptionPlacement);
        expect(Object.keys(newItem.settings)).not.toContain(Object.keys(BAD_SETTING)[0]);
      });
      it('Bad request if id is invalid', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: '/api/items/invalid-id',
          payload,
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Bad Request if extra is invalid', async () => {
        const payload = {
          name: 'new name',
          extra: { key: 'false' },
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${uuidv4()}`,
          payload,
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Cannot update not found item given id', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const payload = {
          name: 'new name',
        };
        const id = uuidv4();
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${id}`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
        expect(response.json().message).toEqual(new ItemNotFound(id).message);
      });
      it('Cannot update item if does not have membership', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{}],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
        };
        mockAuthenticate(actor);
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${item.id}`,
          payload,
        });
        expect(response.json()).toEqual(new MemberCannotAccess(item.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
      it('Cannot update item if has only read membership', async () => {
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
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${item.id}`,
          payload: { name: 'newname' },
        });
        expect(response.json()).toEqual(new MemberCannotWriteItem(item.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });
  // delete many items
  describe('DELETE /api/items', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });
      const response = await app.inject({
        method: HttpMethod.Delete,
        url: '/api/items',
        query: { id: [item.id] },
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    describe('Signed In', () => {
      it('Delete successfully', async () => {
        const {
          actor,
          items: [item1, item2],
          itemMemberships: [im1, im2],
        } = await seedFromJson({
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

        const items = [item1, item2];
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: '/api/items',
          query: { id: items.map(({ id }) => id) },
        });
        expect(response.json()).toEqual(items.map(({ id }) => id));
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        await waitForExpect(async () => {
          const remaining = await db.query.itemsRawTable.findMany({
            where: inArray(itemsRawTable.id, [item1.id, item2.id]),
          });
          expect(remaining).toHaveLength(0);
          const memberships = await db.query.itemMembershipsTable.findMany({
            where: inArray(itemMembershipsTable.id, [im1.id, im2.id]),
          });
          expect(memberships).toHaveLength(0);
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Delete successfully one item', async () => {
        const {
          actor,
          items: [item1],
          itemMemberships: [im1],
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
          method: HttpMethod.Delete,
          url: '/api/items',
          query: { id: [item1.id] },
        });
        expect(response.json()).toEqual([item1.id]);
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        await waitForExpect(async () => {
          const remaining = await db.query.itemsRawTable.findFirst({
            where: eq(itemsRawTable.id, item1.id),
          });
          expect(remaining).toBeUndefined();
          const memberships = await db.query.itemMembershipsTable.findFirst({
            where: eq(itemMembershipsTable.id, im1.id),
          });
          expect(memberships).toBeUndefined();
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Delete successfully one item in parent, with children and memberships', async () => {
        const {
          actor,
          items,
          itemMemberships: ims,
        } = await seedFromJson({
          items: [
            {
              memberships: [
                { account: 'actor', permission: PermissionLevel.Admin },
                { account: { name: 'bob' }, permission: PermissionLevel.Admin },
              ],
              children: [{ children: [{ memberships: [{ account: { name: 'bob' } }] }] }],
            },
          ],
        });
        items.sort((a, b) => (a.path > b.path ? 1 : -1));
        const [root, parent] = items;
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: '/api/items',
          query: { id: [parent.id] },
        });
        expect(response.json()).toEqual([parent.id]);
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        await waitForExpect(async () => {
          // should keep root
          const remaining = await db.query.itemsRawTable.findMany({
            where: inArray(
              itemsRawTable.id,
              items.map((i) => i.id),
            ),
          });

          expect(remaining).toHaveLength(1);
          expect(remaining[0].id).toEqual(root.id);
          // should keep root membership for actor and member
          const memberships = await db.query.itemMembershipsTable.findMany({
            where: inArray(
              itemMembershipsTable.id,
              ims.map((i) => i.id),
            ),
          });
          expect(memberships).toHaveLength(2);
          // ws should not fail
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Delete recycled items', async () => {
        const {
          actor,
          items: [item1, item2],
          itemMemberships: [im1, im2],
        } = await seedFromJson({
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
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const items = [item1, item2];
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: '/api/items',
          query: { id: items.map(({ id }) => id) },
        });
        expect(response.json()).toEqual(items.map(({ id }) => id));
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        await waitForExpect(async () => {
          const remaining = await db.query.itemsRawTable.findMany({
            where: inArray(itemsRawTable.id, [item1.id, item2.id]),
          });
          expect(remaining).toHaveLength(0);
          const memberships = await db.query.itemMembershipsTable.findMany({
            where: inArray(itemMembershipsTable.id, [im1.id, im2.id]),
          });
          expect(memberships).toHaveLength(0);
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Do not delete items with write permission', async () => {
        const {
          actor,
          items: [item1, item2],
        } = await seedFromJson({
          items: [
            {
              isDeleted: true,
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
            },
            {
              isDeleted: true,
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const items = [item1, item2];
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: '/api/items',
          query: { id: items.map(({ id }) => id) },
        });
        expect(response.json()).toEqual(items.map(({ id }) => id));
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        await new Promise((done) => {
          // wait one second for the operation to apply, because this is already the start state
          setTimeout(async () => {
            const remaining = await db.query.itemsRawTable.findMany({
              where: inArray(itemsRawTable.id, [item1.id, item2.id]),
            });
            expect(remaining).toHaveLength(2);

            done(true);
          }, 1000);
        });
      });
      it('Bad request if one id is invalid', async () => {
        const { actor, items } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {},
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: '/api/items',
          query: { id: [...items.map(({ id }) => id), 'invalid-id'] },
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Does not delete items if item does not exist', async () => {
        const { actor, items } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {},
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const itemIds = items.map(({ id }) => id);
        const missingId = uuidv4();
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: '/api/items',
          query: { id: [...itemIds, missingId] },
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // items should still exist
        await waitForExpect(async () => {
          const remaining = await db.query.itemsRawTable.findMany({
            where: inArray(itemsRawTable.id, itemIds),
          });
          expect(remaining).toHaveLength(items.length);
        });
      });
    });
  });

  describe('PATCH /api/items/id/reorder', () => {
    it('Throws if signed out', async () => {
      const {
        items: [toReorder, previousItem],
      } = await seedFromJson({ actor: null, items: [{}, {}] });
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/api/items/${toReorder.id}/reorder`,
        payload: {
          previousItemId: previousItem.id,
        },
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    describe('Signed In', () => {
      it('reorder at beginning', async () => {
        const {
          actor,
          items: [_parentItem, toReorder, previousItem],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [{ order: 10 }, { order: 5 }],
            },
          ],
        });
        expect(toReorder.order).toBeGreaterThan(previousItem.order!);
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${toReorder.id}/reorder`,
          payload: {},
        });
        expect(response.statusCode).toBe(StatusCodes.OK);

        // should have order smaller than first item
        const reorderedItemOrder = await getItemOrder(toReorder);
        const previousItemOrder = await getItemOrder(previousItem);
        expect(reorderedItemOrder).toBeLessThan(previousItemOrder!);
      });
      it('reorder at same place', async () => {
        const {
          actor,
          items: [_parentItem, toReorder, previousItem],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [{ order: 10 }, { order: 5 }],
            },
          ],
        });
        expect(toReorder.order).toBeGreaterThan(previousItem.order!);
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${toReorder.id}/reorder`,
          payload: {
            previousItemId: previousItem.id,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);

        const reorderedItemOrder = await getItemOrder(toReorder);
        const previousItemOrder = await getItemOrder(previousItem);
        expect(reorderedItemOrder).toBeGreaterThan(previousItemOrder!);
      });
      it('reorder at end', async () => {
        const {
          actor,
          items: [_parentItem, toReorder, _firstItem, previousItem],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [{ order: 10 }, { order: 5 }, { order: 15 }],
            },
          ],
        });
        expect(toReorder.order).toBeLessThan(previousItem.order!);
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${toReorder.id}/reorder`,
          payload: {
            previousItemId: previousItem.id,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const reorderedItemOrder = await getItemOrder(toReorder);
        const previousItemOrder = await getItemOrder(previousItem);
        expect(reorderedItemOrder).toBeGreaterThan(previousItemOrder!);
      });
      it('reorder in between', async () => {
        const {
          actor,
          items: [_parentItem, toReorder, previousItem, afterItem],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [{ order: 20 }, { order: 5 }, { order: 15 }],
            },
          ],
        });
        expect(toReorder.order).toBeGreaterThan(previousItem.order!);
        expect(toReorder.order).toBeGreaterThan(afterItem.order!);
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${toReorder.id}/reorder`,
          payload: {
            previousItemId: previousItem.id,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const reorderedItemOrder = await getItemOrder(toReorder);
        const previousItemOrder = await getItemOrder(previousItem);
        const afterItemOrder = await getItemOrder(afterItem);
        expect(reorderedItemOrder).toBeGreaterThan(previousItemOrder!);
        expect(reorderedItemOrder).toBeLessThan(afterItemOrder!);
      });
      it('reorder in root throws', async () => {
        const {
          actor,
          items: [toReorder, previousItem],
        } = await seedFromJson({
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
          method: HttpMethod.Patch,
          url: `/api/items/${toReorder.id}/reorder`,
          payload: {
            previousItemId: previousItem.id,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(await getItemOrder(toReorder)).toBeNull();
      });
    });
  });
  // move many items
  describe('POST /api/items/move', () => {
    it('Throws if signed out', async () => {
      const {
        items: [parent, item],
      } = await seedFromJson({
        actor: null,
        items: [{}, {}],
      });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/move',
        query: { id: [item.id] },
        payload: {
          parentId: parent.id,
        },
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    describe('Signed In', () => {
      it('Move successfully root item to parent', async () => {
        const {
          actor,
          items: [parent, item1, item2, item3],
          itemMemberships: [_parentIm, im1],
        } = await seedFromJson({
          items: [
            { memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] },
            { memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] },
            { memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] },
            { memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const items = [item1, item2, item3];

        const response = await app.inject({
          method: HttpMethod.Post,
          url: 'api/items/move',
          query: { id: items.map(({ id }) => id) },
          payload: {
            parentId: parent.id,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // item should have a different path
        await waitForExpect(async () => {
          for (const item of items) {
            const result = await db.query.itemsRawTable.findFirst({
              where: eq(itemsRawTable.id, item.id),
            });
            expect(result!.path.startsWith(parent.path)).toBeTruthy();
            // membership should have been deleted because has admin rights on parent
            const im = await db.query.itemMembershipsTable.findFirst({
              where: eq(itemMembershipsTable.id, im1.id),
            });
            expect(im).toBeUndefined();
          }
          // order is defined, order is not guaranteed because moving is done in parallel
          const orders = await Promise.all(items.map(async (i) => await getItemOrder(i)));
          orders.forEach((o) => expect(o).toBeGreaterThan(0));
          // unique values
          expect(orders.length).toEqual(new Set(orders).size);
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Move successfully items to root', async () => {
        const {
          actor,
          items: [parentItem, item1, item2, item3],
          itemMemberships: [_parentIm, _im1],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [{}, {}, {}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const items = [item1, item2, item3];
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/move',
          query: { id: items.map(({ id }) => id) },
          payload: {},
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // item should have a differnt path
        await waitForExpect(async () => {
          for (const item of items) {
            const result = await db.query.itemsRawTable.findFirst({
              where: eq(itemsRawTable.id, item.id),
            });
            if (!result) {
              throw new Error('item does not exist!');
            }
            expect(result.path.startsWith(parentItem.path)).toBeFalsy();
            // order is defined, order is not guaranteed because moving is done in parallel
            expect(result.order).toBeNull();
          }
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Move successfully item to root and create new membership', async () => {
        const {
          actor,
          items: [parentItem, item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/move',
          query: { id: item.id },
          payload: {},
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // item should have a different path
        await waitForExpect(async () => {
          const result = await db.query.itemsRawTable.findFirst({
            where: eq(itemsRawTable.id, item.id),
          });
          if (!result) {
            throw new Error('item does not exist!');
          }
          expect(result.path.startsWith(parentItem.path)).toBeFalsy();
          // membership should have been created
          const im = await db.query.itemMembershipsTable.findFirst({
            where: eq(itemMembershipsTable.itemPath, result.path),
          });
          expect(im).toBeDefined();
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Move successfully item to child and delete same membership', async () => {
        const {
          actor,
          items: [parentItem, item],
        } = await seedFromJson({
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
          method: HttpMethod.Post,
          url: '/api/items/move',
          query: { id: item.id },
          payload: { parentId: parentItem.id },
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // item should have a different path
        await waitForExpect(async () => {
          const result = await db.query.itemsRawTable.findFirst({
            where: eq(itemsRawTable.id, item.id),
          });
          if (!result) {
            throw new Error('item does not exist!');
          }
          expect(result.path.startsWith(parentItem.path)).toBeTruthy();
          // membership should have been deleted
          const im = await db.query.itemMembershipsTable.findFirst({
            where: eq(itemMembershipsTable.itemPath, result.path),
          });
          expect(im).toBeUndefined();
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Move successfully items to another parent', async () => {
        const {
          actor,
          items: [parentItem, _parent, item1, item2, item3],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              children: [{}, {}, {}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const items = [item1, item2, item3];
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/move',
          query: { id: items.map(({ id }) => id) },
          payload: {
            parentId: parentItem.id,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // item should have a different path
        await waitForExpect(async () => {
          for (const item of items) {
            const result = await db.query.itemsRawTable.findFirst({
              where: eq(itemsRawTable.id, item.id),
            });
            if (!result) {
              throw new Error('item does not exist!');
            }
            expect(result.path.startsWith(parentItem.path)).toBeTruthy();
          }
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Move lots of items', async () => {
        const {
          actor,
          items: [parentItem, ...items],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            ...Array.from({ length: MAX_TARGETS_FOR_MODIFY_REQUEST }, () => ({
              memberships: [{ account: 'actor' as SeedActor, permission: PermissionLevel.Admin }],
            })),
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/move',
          query: { id: items.map(({ id }) => id) },
          payload: {
            parentId: parentItem.id,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // wait a bit for tasks to complete
        await waitForExpect(async () => {
          for (const item of items) {
            const result = await db.query.itemsRawTable.findFirst({
              where: eq(itemsRawTable.id, item.id),
            });
            if (!result) {
              throw new Error('item does not exist!');
            }
            expect(result.path.startsWith(parentItem.path)).toBeTruthy();
          }
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Bad request if one id is invalid', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/move',
          query: { id: [uuidv4(), 'invalid-id'] },
          payload: {},
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Fail to move item that does not exist', async () => {
        const {
          actor,
          items: [parentItem],
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

        const websocketMock = jest.spyOn(WebsocketService.prototype, 'publish');
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/move',
          query: { id: [uuidv4()] },
          payload: {
            parentId: parentItem.id,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // item should have a different path
        await waitForExpect(async () => {
          expect(websocketMock).toHaveBeenCalled();

          const result = await db.query.itemsRawTable.findMany({
            where: isDirectChild(itemsRawTable.path, parentItem.path),
          });
          expect(result).toHaveLength(0);
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
    });
  });
  // copy many items
  describe('POST /api/items/copy', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{}] });
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/copy',
        query: { id: [item.id] },
        payload: {},
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    describe('Signed In', () => {
      it('Copy successfully from root to root', async () => {
        const settings = { hasThumbnail: false, isResizable: true, isCollapsible: true };
        const { actor, items } = await seedFromJson({
          items: [
            {
              creator: { name: 'bob' },
              lang: 'fr',
              settings,
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              creator: { name: 'bob' },
              lang: 'fr',
              settings,
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              creator: { name: 'bob' },
              lang: 'fr',
              settings,
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/copy',
          query: { id: items.map(({ id }) => id) },
          payload: {},
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // wait a bit for tasks to complete
        await waitForExpect(async () => {
          for (const { name, creatorId } of items) {
            const itemsInDb1 = await db.query.itemsRawTable.findMany({
              where: eq(itemsRawTable.name, name),
            });
            const itemsInDb2 = await db.query.itemsRawTable.findMany({
              where: eq(itemsRawTable.name, `${name} (2)`),
            });
            expect(itemsInDb1).toHaveLength(1);
            expect(itemsInDb2).toHaveLength(1);
            const itemsInDb = [...itemsInDb1, ...itemsInDb2];
            expect(itemsInDb).toHaveLength(2);
            // expect copied data
            expect(itemsInDb[0].type).toEqual(itemsInDb[1].type);
            expect(itemsInDb[0].description).toEqual(itemsInDb[1].description);
            expect(itemsInDb[0].settings).toEqual(settings);
            expect(itemsInDb[1].settings).toEqual(settings);
            expect(itemsInDb[0].lang).toEqual(itemsInDb[1].lang);
            // copy's creator is actor
            expect(itemsInDb[0].creatorId).toEqual(creatorId);
            expect(itemsInDb[1].creatorId).toEqual(actor.id);
            // id and path are different
            expect(itemsInDb[0].id).not.toEqual(itemsInDb[1].id);
            expect(itemsInDb[0].path).not.toEqual(itemsInDb[1].path);
            expect(itemsInDb2[0].order).toBeNull();
            // check it created a new membership per item
            const m1 = await db.query.itemMembershipsTable.findFirst({
              where: eq(itemMembershipsTable.itemPath, itemsInDb1[0].path),
            });
            expect(m1).toBeDefined();
            const m2 = await db.query.itemMembershipsTable.findFirst({
              where: eq(itemMembershipsTable.itemPath, itemsInDb2[0].path),
            });
            expect(m2).toBeDefined();
          }
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Copy successfully from root to item with admin rights', async () => {
        const {
          actor,
          items: [targetItem, ...items],
        } = await seedFromJson({
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
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/copy',
          query: { id: items.map(({ id }) => id) },
          payload: {
            parentId: targetItem.id,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // wait a bit for tasks to complete
        await waitForExpect(async () => {
          // contains twice the items (and the target item)
          const orders: (number | null)[] = [];
          for (const { id, name } of items) {
            const itemsInDb = await db.query.itemsRawTable.findMany({
              where: and(eq(itemsRawTable.name, name), eq(itemsRawTable.id, id)),
            });
            expect(itemsInDb).toHaveLength(1);
            const copiedItemInDb = await db.query.itemsRawTable.findMany({
              where: and(eq(itemsRawTable.name, name), ne(itemsRawTable.id, id)),
            });
            expect(copiedItemInDb).toHaveLength(1);
            orders.push(copiedItemInDb[0].order);
            // check it did not create a new membership because user is admin of parent
            const newCountMembership = await db.query.itemMembershipsTable.findMany({
              where: inArray(itemMembershipsTable.itemPath, [
                itemsInDb[0].path,
                copiedItemInDb[0].path,
              ]),
            });
            expect(newCountMembership).toHaveLength(1);
          }
          // order is defined, order is not guaranteed because moving is done in parallel
          orders.forEach((o) => expect(o).toBeGreaterThan(0));
          // unique values
          expect(orders.length).toEqual(new Set(orders).size);
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Copy successfully from root to item with write rights', async () => {
        const {
          actor,
          items: [targetItem, ...items],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
            },
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
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/copy',
          query: { id: items.map(({ id }) => id) },
          payload: {
            parentId: targetItem.id,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // wait a bit for tasks to complete
        await waitForExpect(async () => {
          // contains twice the items (and the target item)
          for (const { id, name } of items) {
            const itemsInDb = await db.query.itemsRawTable.findMany({
              where: and(eq(itemsRawTable.name, name), eq(itemsRawTable.id, id)),
            });
            expect(itemsInDb).toHaveLength(1);
            const copiedItemInDb = await db.query.itemsRawTable.findMany({
              where: and(eq(itemsRawTable.name, name), ne(itemsRawTable.id, id)),
            });
            expect(copiedItemInDb).toHaveLength(1);
            // check it created a new membership because user is writer of parent
            const newCountMembership = await db.query.itemMembershipsTable.findMany({
              where: inArray(itemMembershipsTable.itemPath, [
                itemsInDb[0].path,
                copiedItemInDb[0].path,
              ]),
            });
            expect(newCountMembership).toHaveLength(2);
          }
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Copy successfully shared root item to home', async () => {
        const commonName = faker.word.sample(2);
        const {
          actor,
          items: [_sharedParent, item],
        } = await seedFromJson({
          items: [
            {
              name: commonName,
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            {
              creator: { name: 'bob' },
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
              children: [
                {
                  name: commonName,
                  memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
                },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/copy',
          query: { id: item.id },
          payload: {},
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // wait a bit for tasks to complete
        await waitForExpect(async () => {
          // contains twice the items (and the target item)
          const itemsInDb1 = await db.query.itemsRawTable.findMany({
            where: eq(itemsRawTable.name, item.name),
          });
          // 2 is added because there is already an item with the same name in the root
          const itemsInDb2 = await db.query.itemsRawTable.findMany({
            where: eq(itemsRawTable.name, `${item.name} (2)`),
          });
          expect(itemsInDb1).toHaveLength(1);
          expect(itemsInDb2).toHaveLength(1);
          // check it created a new membership because user is writer of parent
          const newCountMembership = await db.query.itemMembershipsTable.findMany({
            where: inArray(itemMembershipsTable.itemPath, [itemsInDb1[0].path, itemsInDb2[0].path]),
          });
          expect(newCountMembership).toHaveLength(2);
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Copy successfully from item to root', async () => {
        const {
          actor,
          items: [_sharedParent, ...items],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
              children: [
                {
                  memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
                },
                {
                  memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
                },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/copy',
          query: { id: items.map(({ id }) => id) },
          payload: {},
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // wait a bit for tasks to complete
        await waitForExpect(async () => {
          // contains twice the items (and the target item)
          for (const { id, name } of items) {
            const itemsInDb = await db.query.itemsRawTable.findMany({
              where: and(eq(itemsRawTable.name, name), eq(itemsRawTable.id, id)),
            });
            expect(itemsInDb).toHaveLength(1);
            const copiedItemInDb = await db.query.itemsRawTable.findMany({
              where: and(eq(itemsRawTable.name, name), ne(itemsRawTable.id, id)),
            });
            expect(copiedItemInDb).toHaveLength(1);
            const newCountMembership = await db.query.itemMembershipsTable.findMany({
              where: inArray(itemMembershipsTable.itemPath, [
                itemsInDb[0].path,
                copiedItemInDb[0].path,
              ]),
            });
            expect(newCountMembership).toHaveLength(2);
            expect(copiedItemInDb[0].order).toBeNull();
          }
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Copy lots of items', async () => {
        const {
          actor,
          items: [parentItem, ...items],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
            ...Array.from({ length: MAX_TARGETS_FOR_MODIFY_REQUEST }, () => ({
              memberships: [{ account: 'actor' as SeedActor, permission: PermissionLevel.Admin }],
            })),
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/copy',
          query: { id: items.map(({ id }) => id) },
          payload: {
            parentId: parentItem.id,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // wait a bit for tasks to complete
        await waitForExpect(async () => {
          for (const item of items) {
            const results = await db.query.itemsRawTable.findMany({
              where: and(eq(itemsRawTable.name, item.name), ne(itemsRawTable.id, item.id)),
            });
            expect(results).toHaveLength(1);
            expect(results[0].path.startsWith(parentItem.path)).toBeTruthy();
          }
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Copy attached geolocation', async () => {
        const {
          actor,
          items: [parentItem, item],
          geolocations: [geoloc],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
            },
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
              geolocation: { lat: 1, lng: 22 },
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/copy',
          query: { id: [item.id] },
          payload: {
            parentId: parentItem.id,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // wait a bit for tasks to complete
        await waitForExpect(async () => {
          const itemsInDb = await db.query.itemsRawTable.findMany({
            where: eq(itemsRawTable.name, item.name),
          });
          expect(itemsInDb).toHaveLength(2);
          for (const i of itemsInDb) {
            const ig = await db.query.itemGeolocationsTable.findMany({
              where: eq(itemGeolocationsTable.itemPath, i.path),
            });
            expect(ig).toHaveLength(1);
            expect(ig[0].lat).toEqual(geoloc.lat);
            expect(ig[0].lng).toEqual(geoloc.lng);
          }
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Copying corrupted ordered item results in correct copy', async () => {
        const {
          actor,
          items: [targetItem, parentItem, c1, c2, c3],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
            },
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
              children: [
                { order: 20, createdAt: '2012-10-05T14:48:00.000Z' },
                { order: 20, createdAt: '2011-10-05T14:48:00.000Z' },
                { order: 20, createdAt: '2013-10-05T14:48:00.000Z' },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/copy',
          query: { id: [parentItem.id] },
          payload: {
            parentId: targetItem.id,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // wait a bit for tasks to complete
        await waitForExpect(async () => {
          const copyRoot = await db.query.itemsRawTable.findFirst({
            where: isDirectChild(itemsRawTable.path, targetItem.path),
          });
          expect(copyRoot).toBeDefined();
          const copiedChildren = await db.query.itemsRawTable.findMany({
            where: isDirectChild(itemsRawTable.path, copyRoot!.path),
            orderBy: asc(itemsRawTable.order),
          });
          expect(copiedChildren).toHaveLength(3);

          // order are repaired
          expect(copiedChildren[0].name).toEqual(c2.name);
          expect(copiedChildren[0].order).toEqual(20);
          expect(copiedChildren[1].name).toEqual(c1.name);
          expect(copiedChildren[1].order).toEqual(40);
          expect(copiedChildren[2].name).toEqual(c3.name);
          expect(copiedChildren[2].order).toEqual(60);
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Bad request if one id is invalid', async () => {
        const { actor, items } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/copy',
          query: { id: [...items.map(({ id }) => id), 'invalid-id'] },
          payload: {},
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Fail to copy if one item does not exist', async () => {
        const {
          actor,
          items: [item, target],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
              creator: 'actor',
            },
            {},
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const missingId = uuidv4();
        const websocketMock = jest.spyOn(WebsocketService.prototype, 'publish');
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/copy',
          query: { id: [item.id, missingId] },
          payload: { parentId: target.id },
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // wait a bit for tasks to complete
        await waitForExpect(async () => {
          // expect copy to have finished
          expect(websocketMock).toHaveBeenCalled();

          const itemsInDb = await db.query.itemsRawTable.findMany({
            where: and(
              eq(itemsRawTable.name, item.name),
              isDirectChild(itemsRawTable.path, target.path),
            ),
          });
          expect(itemsInDb).toHaveLength(0);
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Fail to copy if parent item is not a folder', async () => {
        const {
          actor,
          items: [parentItem, item],
        } = await seedFromJson({
          items: [
            {
              creator: 'actor',
              type: ItemType.DOCUMENT,
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
            },
            {
              creator: 'actor',
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const websocketMock = jest.spyOn(WebsocketService.prototype, 'publish');
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/copy',
          query: { id: [item.id] },
          payload: {
            parentId: parentItem.id,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // wait a bit for tasks to complete
        await waitForExpect(async () => {
          // expect copy to have finished
          expect(websocketMock).toHaveBeenCalled();

          const itemsInDb = await db.query.itemsRawTable.findMany({
            where: and(
              eq(itemsRawTable.name, item.name),
              isDirectChild(itemsRawTable.path, parentItem.path),
            ),
          });
          expect(itemsInDb).toHaveLength(0);
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
    });
  });
});
