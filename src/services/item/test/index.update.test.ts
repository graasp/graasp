import { faker } from '@faker-js/faker';
import { Child } from 'bullmq/dist/esm/classes/child';
import { eq, inArray } from 'drizzle-orm';
import FormData from 'form-data';
import fs from 'fs';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import waitForExpect from 'wait-for-expect';

import { FastifyInstance } from 'fastify';

import {
  DescriptionPlacement,
  FolderItemFactory,
  HttpMethod,
  ItemType,
  MAX_NUMBER_OF_CHILDREN,
  MAX_TARGETS_FOR_MODIFY_REQUEST,
  MAX_TREE_LEVELS,
  PermissionLevel,
  buildPathFromIds,
} from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../../test/app';
import { MULTIPLE_ITEMS_LOADING_TIME } from '../../../../test/constants';
import { SeedActor, seedFromJson } from '../../../../test/mocks/seed';
import { resolveDependency } from '../../../di/utils';
import { db } from '../../../drizzle/db';
import { itemGeolocationsTable, itemMemberships, itemsRaw } from '../../../drizzle/schema';
import { Item } from '../../../drizzle/types';
import { MinimalMember } from '../../../types';
import { assertIsDefined } from '../../../utils/assertions';
import {
  HierarchyTooDeep,
  ItemNotFolder,
  ItemNotFound,
  MemberCannotAccess,
  MemberCannotWriteItem,
  TooManyChildren,
} from '../../../utils/errors';
import { assertIsMemberForTest } from '../../authentication';
import { saveMember } from '../../member/test/fixtures/members';
import { ActionItemService } from '../plugins/action/action.service';
import { ItemService } from '../service';
import { expectItem } from './fixtures/items';
import { getItemWithDepth } from './utils';

const getItemOrder = async (item: { id: string }) => {
  const val = await db.query.itemsRaw.findFirst({
    columns: { order: true },
    where: eq(itemsRaw.id, item.id),
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

  describe('POST /items', () => {
    it('Throws if signed out', async () => {
      const payload = FolderItemFactory();
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Schema validation', () => {
      it('Throw if geolocation is partial', async () => {
        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items`,
          payload: { ...payload, geolocation: { lat: 1 } },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);

        const response1 = await app.inject({
          method: HttpMethod.Post,
          url: `/items`,
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
          url: '/items',
          payload: newItem,
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);

        // by default the item creator use an invalid item type
        const newItem1 = FolderItemFactory({ name: ' ' });
        const response1 = await app.inject({
          method: HttpMethod.Post,
          url: '/items',
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
          url: '/items',
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
          url: `/items?parentId=${parentId}`,
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
        const actionItemServicePostPostAction = jest.spyOn(
          ActionItemService.prototype,
          'postPostAction',
        );

        // The API's is still working with the database after responding to an item post request,
        // so we need to wait for the work to be done so we don't have flacky deadlock exceptions.
        waitForPostCreation = async () => {
          return await waitForExpect(async () => {
            expect(itemServiceRescaleOrderForParent).toHaveBeenCalled();
            expect(actionItemServicePostPostAction).toHaveBeenCalled();
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
          url: '/items',
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        // check response value
        const newItem = response.json();
        expectItem(newItem, payload);
        await waitForPostCreation();

        // check item exists in db
        const item = await db.query.itemsRaw.findFirst({ where: eq(itemsRaw.id, newItem.id) });
        expect(item).toBeDefined();
        // order is null for root
        expect(item!.order).toBeNull();

        // a membership is created for this item
        const membership = await await db.query.itemMemberships.findFirst({
          where: eq(itemMemberships.itemPath, newItem.path),
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
          url: `/items?parentId=${parent.id}`,
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
        const newMembership = await db.query.itemMemberships.findFirst({
          where: eq(itemMemberships.itemPath, newItem.path),
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
          url: `/items?parentId=${parent.id}`,
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
          await db.query.itemMemberships.findFirst({
            where: eq(itemMemberships.itemPath, newItem.path),
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
          url: `/items`,
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
          url: `/items`,
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
          url: `/items`,
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
          url: `/items`,
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
          url: `/items`,
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
          url: `/items`,
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
          url: `/items`,
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
          url: `/items`,
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
          url: `/items?parentId=${parentId}`,
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
          url: `/items?parentId=${parent.id}`,
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
          url: `/items?parentId=${parent.id}`,
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
          url: `/items?parentId=${parent.id}`,
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
          url: `/items?parentId=${deepestItem.id}`,
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
          url: `/items?parentId=${parent.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(response.json()).toMatchObject(new ItemNotFolder({ id: parent.id }));
      });
    });
  });

  describe('POST /items/with-thumbnail', () => {
    it('Post item with thumbnail', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);
      const imageStream = fs.createReadStream(path.resolve(__dirname, './fixtures/image.png'));
      const itemName = 'Test Item';
      const payload = new FormData();
      payload.append('name', itemName);
      payload.append('type', ItemType.FOLDER);
      payload.append('description', '');
      payload.append('file', imageStream);
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/with-thumbnail`,
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

  describe('PATCH /items/:id', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/${item.id}`,
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
          url: `/items/${item.id}`,
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
          url: `/items/${item.id}`,
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
          url: `/items/${item.id}`,
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
          url: `/items/${item.id}`,
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
          url: `/items/${item.id}`,
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
          url: '/items/invalid-id',
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
          url: `/items/${uuidv4()}`,
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
          url: `/items/${id}`,
          payload,
        });
        expect(response.json()).toEqual(new ItemNotFound(id));
        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
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
          url: `/items/${item.id}`,
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
          url: `/items/${item.id}`,
          payload: { name: 'newname' },
        });
        expect(response.json()).toEqual(new MemberCannotWriteItem(item.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });
  // delete many items
  describe('DELETE /items', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });
      const response = await app.inject({
        method: HttpMethod.Delete,
        url: '/items',
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
          url: '/items',
          query: { id: items.map(({ id }) => id) },
        });
        expect(response.json()).toEqual(items.map(({ id }) => id));
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        await waitForExpect(async () => {
          const remaining = await db.query.itemsRaw.findMany({
            where: inArray(itemsRaw.id, [item1.id, item2.id]),
          });
          expect(remaining).toHaveLength(0);
          const memberships = await db.query.itemMemberships.findMany({
            where: inArray(itemMemberships.id, [im1.id, im2.id]),
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
          url: '/items',
          query: { id: [item1.id] },
        });
        expect(response.json()).toEqual([item1.id]);
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        await waitForExpect(async () => {
          const remaining = await db.query.itemsRaw.findFirst({
            where: eq(itemsRaw.id, item1.id),
          });
          expect(remaining).toBeUndefined();
          const memberships = await db.query.itemMemberships.findFirst({
            where: eq(itemMemberships.id, im1.id),
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
        const [root, parent] = items;
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: '/items',
          query: { id: [parent.id] },
        });
        expect(response.json()).toEqual([parent.id]);
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        await waitForExpect(async () => {
          // should keep root
          const remaining = await db.query.itemsRaw.findMany({
            where: inArray(
              itemsRaw.id,
              items.map((i) => i.id),
            ),
          });
          expect(remaining).toHaveLength(1);
          expect(remaining[0].id).toEqual(root.id);
          // should keep root membership for actor and member
          const memberships = await db.query.itemMemberships.findMany({
            where: inArray(
              itemMemberships.id,
              ims.map((i) => i.id),
            ),
          });
          expect(memberships).toHaveLength(2);
          // ws should not fail
        }, MULTIPLE_ITEMS_LOADING_TIME);
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
          url: '/items',
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
          url: '/items',
          query: { id: [...itemIds, missingId] },
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // items should still exist
        await waitForExpect(async () => {
          const remaining = await db.query.itemsRaw.findMany({
            where: inArray(itemsRaw.id, itemIds),
          });
          expect(remaining).toHaveLength(items.length);
        });
      });
    });
  });
  // move many items
  describe('POST /items/move', () => {
    it('Throws if signed out', async () => {
      const {
        items: [parent, item],
      } = await seedFromJson({
        actor: null,
        items: [{}, {}],
      });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items/move',
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
          url: '/items/move',
          query: { id: items.map(({ id }) => id) },
          payload: {
            parentId: parent.id,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // item should have a different path
        await waitForExpect(async () => {
          // expect(true).toBe(false);
          for (const item of items) {
            const result = await db.query.itemsRaw.findFirst({ where: eq(itemsRaw.id, item.id) });
            expect(result!.path.startsWith(parent.path)).toBeTruthy();
            // membership should have been deleted because has admin rights on parent
            const im = await db.query.itemMemberships.findFirst({
              where: eq(itemMemberships.id, im1.id),
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
          itemMemberships: [_parentIm, im1],
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
          url: '/items/move',
          query: { id: items.map(({ id }) => id) },
          payload: {},
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // item should have a differnt path
        await waitForExpect(async () => {
          for (const item of items) {
            const result = await db.query.itemsRaw.findFirst({ where: eq(itemsRaw.id, item.id) });
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
          url: '/items/move',
          query: { id: item.id },
          payload: {},
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // item should have a different path
        await waitForExpect(async () => {
          const result = await db.query.itemsRaw.findFirst({ where: eq(itemsRaw.id, item.id) });
          if (!result) {
            throw new Error('item does not exist!');
          }
          expect(result.path.startsWith(parentItem.path)).toBeFalsy();
          // membership should have been created
          const im = await db.query.itemMemberships.findFirst({
            where: eq(itemMemberships.itemPath, result.path),
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
          url: '/items/move',
          query: { id: item.id },
          payload: { parentId: parentItem.id },
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // item should have a different path
        await waitForExpect(async () => {
          const result = await db.query.itemsRaw.findFirst({ where: eq(itemsRaw.id, item.id) });
          if (!result) {
            throw new Error('item does not exist!');
          }
          expect(result.path.startsWith(parentItem.path)).toBeTruthy();
          // membership should have been deleted
          const im = await db.query.itemMemberships.findFirst({
            where: eq(itemMemberships.itemPath, result.path),
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
          url: '/items/move',
          query: { id: items.map(({ id }) => id) },
          payload: {
            parentId: parentItem.id,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // item should have a different path
        await waitForExpect(async () => {
          for (const item of items) {
            const result = await db.query.itemsRaw.findFirst({ where: eq(itemsRaw.id, item.id) });
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
          url: '/items/move',
          query: { id: [uuidv4(), 'invalid-id'] },
          payload: {},
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Fail to move items if one item does not exist', async () => {
        const {
          actor,
          items: [parentItem, item1, item2, item3],
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

        const items = [item1, item2, item3];
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items/move',
          query: { id: [...items.map(({ id }) => id), uuidv4()] },
          payload: {
            parentId: parentItem.id,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // item should have a different path
        await waitForExpect(async () => {
          for (const item of items) {
            const result = await db.query.itemsRaw.findFirst({ where: eq(itemsRaw.id, item.id) });
            if (!result) {
              throw new Error('item does not exist!');
            }
            expect(result.path.startsWith(parentItem.path)).toBeFalsy();
          }
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Move lots of items', async () => {
        const {
          actor,
          items: [parentItem, item1, item2, item3],
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

        const items = [item1, item2, item3];
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items/move',
          query: { id: items.map(({ id }) => id) },
          payload: {
            parentId: parentItem.id,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        // wait a bit for tasks to complete
        await waitForExpect(async () => {
          for (const item of items) {
            const result = await db.query.itemsRaw.findFirst({ where: eq(itemsRaw.id, item.id) });
            if (!result) {
              throw new Error('item does not exist!');
            }
            expect(result.path.startsWith(parentItem.path)).toBeTruthy();
          }
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
    });
  });
  // // copy many items
  describe('POST /items/copy', () => {
    //   it('Throws if signed out', async () => {
    //     const member = await saveMember();
    //     const { item } = await testUtils.saveItemAndMembership({ member });
    //     const response = await app.inject({
    //       method: HttpMethod.Post,
    //       url: '/items/copy',
    //       query: { id: [item.id] },
    //       payload: {},
    //     });
    //     expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    //   });
    //   describe('Signed In', () => {
    //     it('Copy successfully from root to root', async () => {
    //       const actor = await saveMember();
    //       mockAuthenticate(actor);
    //       assertIsDefined(actor);
    //       const settings = { hasThumbnail: false, isResizable: true, isCollapsible: true };
    //       const creator = await saveMember();
    //       const items = await saveNbOfItems({
    //         nb: 3,
    //         actor: creator,
    //         item: { lang: 'fr', settings },
    //         member: actor,
    //       });
    //       const response = await app.inject({
    //         method: HttpMethod.Post,
    //         url: '/items/copy',
    //         query: { id: items.map(({ id }) => id) },
    //         payload: {},
    //       });
    //       expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
    //       // wait a bit for tasks to complete
    //       await waitForExpect(async () => {
    //         for (const { name } of items) {
    //           const itemsInDb1 = await testUtils.rawItemRepository.find({
    //             where: { name },
    //             relations: { creator: true },
    //           });
    //           const itemsInDb2 = await testUtils.rawItemRepository.find({
    //             where: { name: `${name} (2)` },
    //             relations: { creator: true },
    //           });
    //           expect(itemsInDb1).toHaveLength(1);
    //           expect(itemsInDb2).toHaveLength(1);
    //           const itemsInDb = [...itemsInDb1, ...itemsInDb2];
    //           expect(itemsInDb).toHaveLength(2);
    //           // expect copied data
    //           expect(itemsInDb[0].type).toEqual(itemsInDb[1].type);
    //           expect(itemsInDb[0].description).toEqual(itemsInDb[1].description);
    //           expect(itemsInDb[0].settings).toEqual(settings);
    //           expect(itemsInDb[1].settings).toEqual(settings);
    //           expect(itemsInDb[0].lang).toEqual(itemsInDb[1].lang);
    //           // creator is different
    //           expect(itemsInDb[0].creator).not.toEqual(itemsInDb[1].creator);
    //           expect([creator.id, actor.id]).toContain(itemsInDb[0].creator!.id);
    //           expect([creator.id, actor.id]).toContain(itemsInDb[1].creator!.id);
    //           // id and path are different
    //           expect(itemsInDb[0].id).not.toEqual(itemsInDb[1].id);
    //           expect(itemsInDb[0].path).not.toEqual(itemsInDb[1].path);
    //           expect(await testUtils.getOrderForItemId(itemsInDb2[0].id)).toBeNull();
    //           // check it created a new membership per item
    //           const m1 = await itemMembershipRawRepository.findBy({
    //             item: { id: itemsInDb1[0].id },
    //           });
    //           expect(m1).toHaveLength(1);
    //           const m2 = await itemMembershipRawRepository.findBy({
    //             item: { id: itemsInDb2[0].id },
    //           });
    //           expect(m2).toHaveLength(1);
    //         }
    //       }, MULTIPLE_ITEMS_LOADING_TIME);
    //     });
    //     it('Copy successfully from root to item with admin rights', async () => {
    //       const actor = await saveMember();
    //       mockAuthenticate(actor);
    //       const { item: targetItem } = await testUtils.saveItemAndMembership({ member: actor });
    //       const items = await saveNbOfItems({ nb: 3, actor });
    //       const response = await app.inject({
    //         method: HttpMethod.Post,
    //         url: '/items/copy',
    //         query: { id: items.map(({ id }) => id) },
    //         payload: {
    //           parentId: targetItem.id,
    //         },
    //       });
    //       expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
    //       // wait a bit for tasks to complete
    //       await waitForExpect(async () => {
    //         // contains twice the items (and the target item)
    //         const orders: (number | null)[] = [];
    //         for (const { id, name } of items) {
    //           const itemsInDb = await testUtils.rawItemRepository.findBy({ name, id });
    //           expect(itemsInDb).toHaveLength(1);
    //           const copiedItemInDb = await testUtils.rawItemRepository.findBy({ name, id: Not(id) });
    //           expect(copiedItemInDb).toHaveLength(1);
    //           orders.push(await testUtils.getOrderForItemId(copiedItemInDb[0].id));
    //           // check it did not create a new membership because user is admin of parent
    //           const newCountMembership = await itemMembershipRawRepository.findBy({
    //             item: { id: In([itemsInDb[0].id, copiedItemInDb[0].id]) },
    //           });
    //           expect(newCountMembership).toHaveLength(1);
    //         }
    //         // order is defined, order is not guaranteed because moving is done in parallel
    //         orders.forEach((o) => expect(o).toBeGreaterThan(0));
    //         // unique values
    //         expect(orders.length).toEqual(new Set(orders).size);
    //       }, MULTIPLE_ITEMS_LOADING_TIME);
    //     });
    //     it('Copy successfully from root to item with write rights', async () => {
    //       const actor = await saveMember();
    //       mockAuthenticate(actor);
    //       const member = await saveMember();
    //       const { item: targetItem } = await testUtils.saveItemAndMembership({
    //         member: actor,
    //         creator: member,
    //         permission: PermissionLevel.Write,
    //       });
    //       const items = await saveNbOfItems({ nb: 3, actor: member, member: actor });
    //       const response = await app.inject({
    //         method: HttpMethod.Post,
    //         url: '/items/copy',
    //         query: { id: items.map(({ id }) => id) },
    //         payload: {
    //           parentId: targetItem.id,
    //         },
    //       });
    //       expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
    //       // wait a bit for tasks to complete
    //       await waitForExpect(async () => {
    //         // contains twice the items (and the target item)
    //         for (const { id, name } of items) {
    //           const itemsInDb = await testUtils.rawItemRepository.findBy({ name, id });
    //           expect(itemsInDb).toHaveLength(1);
    //           const copiedItemInDb = await testUtils.rawItemRepository.findBy({ name, id: Not(id) });
    //           expect(copiedItemInDb).toHaveLength(1);
    //           // check it created a new membership because user is writer of parent
    //           const newCountMembership = await itemMembershipRawRepository.findBy({
    //             item: { id: In([itemsInDb[0].id, copiedItemInDb[0].id]) },
    //           });
    //           expect(newCountMembership).toHaveLength(2);
    //         }
    //       }, MULTIPLE_ITEMS_LOADING_TIME);
    //     });
    //     it('Copy successfully shared root item to home', async () => {
    //       const actor = await saveMember();
    //       mockAuthenticate(actor);
    //       const member = await saveMember();
    //       const { item } = await testUtils.saveItemAndMembership({
    //         member: actor,
    //         creator: member,
    //         permission: PermissionLevel.Admin,
    //       });
    //       const { item: youngParent } = await testUtils.saveItemAndMembership({
    //         member: actor,
    //         creator: member,
    //         permission: PermissionLevel.Admin,
    //         parentItem: item,
    //       });
    //       // children, saved in weird order (children updated first so it appears first when fetching)
    //       await testUtils.saveItemAndMembership({
    //         member: actor,
    //         creator: member,
    //         permission: PermissionLevel.Admin,
    //         parentItem: youngParent,
    //       });
    //       await testUtils.saveItemAndMembership({
    //         member: actor,
    //         creator: member,
    //         permission: PermissionLevel.Admin,
    //         parentItem: item,
    //       });
    //       await app.inject({
    //         method: HttpMethod.Patch,
    //         url: `/items/${youngParent.id}`,
    //         payload: {
    //           name: 'new name',
    //         },
    //       });
    //       const response = await app.inject({
    //         method: HttpMethod.Post,
    //         url: '/items/copy',
    //         query: { id: item.id },
    //         payload: {},
    //       });
    //       expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
    //       // wait a bit for tasks to complete
    //       await waitForExpect(async () => {
    //         // contains twice the items (and the target item)
    //         const itemsInDb1 = await testUtils.rawItemRepository.find({
    //           where: { name: item.name },
    //         });
    //         const itemsInDb2 = await testUtils.rawItemRepository.find({
    //           where: { name: `${item.name} (2)` },
    //         });
    //         expect(itemsInDb1).toHaveLength(1);
    //         expect(itemsInDb2).toHaveLength(1);
    //         // check it created a new membership because user is writer of parent
    //         const newCountMembership = await itemMembershipRawRepository.findBy({
    //           item: { id: In([itemsInDb1[0].id, itemsInDb2[0].id]) },
    //         });
    //         expect(newCountMembership).toHaveLength(2);
    //       }, MULTIPLE_ITEMS_LOADING_TIME);
    //     });
    //     it('Copy successfully from item to root', async () => {
    //       const actor = await saveMember();
    //       mockAuthenticate(actor);
    //       const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
    //       const items = await saveNbOfItems({ nb: 3, actor, parentItem });
    //       const response = await app.inject({
    //         method: HttpMethod.Post,
    //         url: '/items/copy',
    //         query: { id: items.map(({ id }) => id) },
    //         payload: {},
    //       });
    //       expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
    //       // wait a bit for tasks to complete
    //       await waitForExpect(async () => {
    //         // contains twice the items (and the target item)
    //         for (const { id, name } of items) {
    //           const itemsInDb = await testUtils.rawItemRepository.findBy({ name, id });
    //           expect(itemsInDb).toHaveLength(1);
    //           const copiedItemInDb = await testUtils.rawItemRepository.findBy({ name, id: Not(id) });
    //           expect(copiedItemInDb).toHaveLength(1);
    //           const newCountMembership = await itemMembershipRawRepository.findBy({
    //             item: { id: In([itemsInDb[0].id, copiedItemInDb[0].id]) },
    //           });
    //           expect(newCountMembership).toHaveLength(2);
    //           expect(await testUtils.getOrderForItemId(copiedItemInDb[0].id)).toBeNull();
    //         }
    //       }, MULTIPLE_ITEMS_LOADING_TIME);
    //     });
    //     it('Bad request if one id is invalid', async () => {
    //       const actor = await saveMember();
    //       mockAuthenticate(actor);
    //       const items = await saveNbOfItems({ nb: 3, actor });
    //       const response = await app.inject({
    //         method: HttpMethod.Post,
    //         url: '/items/copy',
    //         query: { id: [...items.map(({ id }) => id), 'invalid-id'] },
    //         payload: {},
    //       });
    //       expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
    //       expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    //     });
    //     it('Fail to copy if one item does not exist', async () => {
    //       const actor = await saveMember();
    //       mockAuthenticate(actor);
    //       const items = await saveNbOfItems({ nb: 3, actor });
    //       const missingId = uuidv4();
    //       const response = await app.inject({
    //         method: HttpMethod.Post,
    //         url: '/items/copy',
    //         query: { id: [...items.map(({ id }) => id), missingId] },
    //         payload: {},
    //       });
    //       expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
    //       // wait a bit for tasks to complete
    //       await waitForExpect(async () => {
    //         for (const item of items) {
    //           const itemsInDb1 = await testUtils.rawItemRepository.find({
    //             where: { name: item.name },
    //           });
    //           expect(itemsInDb1).toHaveLength(1);
    //           const itemsInDb2 = await testUtils.rawItemRepository.find({
    //             where: { name: `${item.name} (2)` },
    //           });
    //           expect(itemsInDb2).toHaveLength(0);
    //         }
    //       }, MULTIPLE_ITEMS_LOADING_TIME);
    //     });
    //     it('Fail to copy if parent item is not a folder', async () => {
    //       const actor = await saveMember();
    //       mockAuthenticate(actor);
    //       const { item } = await testUtils.saveItemAndMembership({
    //         member: actor,
    //         item: { type: ItemType.DOCUMENT },
    //       });
    //       const { item: parentItem } = await testUtils.saveItemAndMembership({
    //         member: actor,
    //         item: { type: ItemType.DOCUMENT },
    //       });
    //       const response = await app.inject({
    //         method: HttpMethod.Post,
    //         url: '/items/copy',
    //         query: { id: [item.id] },
    //         payload: {
    //           parentId: parentItem.id,
    //         },
    //       });
    //       expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
    //       // wait a bit for tasks to complete
    //       await waitForExpect(async () => {
    //         const itemsInDb1 = await testUtils.rawItemRepository.find({
    //           where: { name: item.name },
    //         });
    //         expect(itemsInDb1).toHaveLength(1);
    //         const itemsInDb2 = await testUtils.rawItemRepository.find({
    //           where: { name: `${item.name} (2)` },
    //         });
    //         expect(itemsInDb2).toHaveLength(0);
    //       }, MULTIPLE_ITEMS_LOADING_TIME);
    //     });
    //     it('Copy lots of items', async () => {
    //       const actor = await saveMember();
    //       mockAuthenticate(actor);
    //       const items = await saveNbOfItems({ nb: MAX_TARGETS_FOR_MODIFY_REQUEST, actor });
    //       const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
    //       const response = await app.inject({
    //         method: HttpMethod.Post,
    //         url: '/items/copy',
    //         query: { id: items.map(({ id }) => id) },
    //         payload: {
    //           parentId: parentItem.id,
    //         },
    //       });
    //       expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
    //       // wait a bit for tasks to complete
    //       await waitForExpect(async () => {
    //         for (const item of items) {
    //           const results = await testUtils.rawItemRepository.findBy({
    //             name: item.name,
    //             id: Not(item.id),
    //           });
    //           expect(results).toHaveLength(1);
    //           expect(results[0].path.startsWith(parentItem.path)).toBeTruthy();
    //         }
    //       }, MULTIPLE_ITEMS_LOADING_TIME);
    //     });
    //     it('Copy attached geolocation', async () => {
    //       const actor = await saveMember();
    //       mockAuthenticate(actor);
    //       const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
    //       const itemGeolocationRepository = AppDataSource.getRepository(ItemGeolocation);
    //       const { item } = await testUtils.saveItemAndMembership({ member: actor });
    //       const geoloc = await itemGeolocationRepository.save({ item, lat: 1, lng: 22 });
    //       const response = await app.inject({
    //         method: HttpMethod.Post,
    //         url: '/items/copy',
    //         query: { id: [item.id] },
    //         payload: {
    //           parentId: parentItem.id,
    //         },
    //       });
    //       expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
    //       // wait a bit for tasks to complete
    //       await waitForExpect(async () => {
    //         const itemsInDb = await testUtils.rawItemRepository.findBy({ name: item.name });
    //         expect(itemsInDb).toHaveLength(2);
    //         for (const i of itemsInDb) {
    //           const ig = await itemGeolocationRepository.findBy({
    //             item: { id: i.id },
    //           });
    //           expect(ig).toHaveLength(1);
    //           expect(ig[0].lat).toEqual(geoloc.lat);
    //           expect(ig[0].lng).toEqual(geoloc.lng);
    //         }
    //       }, MULTIPLE_ITEMS_LOADING_TIME);
    //     });
    //   });
    // });
    // describe('PATCH /items/id/reorder', () => {
    //   it('Throws if signed out', async () => {
    //     const member = await saveMember();
    //     const { item: parentItem } = await testUtils.saveItemAndMembership({ member });
    //     const toReorder = await testUtils.saveItem({
    //       actor: member,
    //       parentItem,
    //     });
    //     const previousItem = await testUtils.saveItem({
    //       actor: member,
    //       parentItem,
    //     });
    //     const response = await app.inject({
    //       method: HttpMethod.Patch,
    //       url: `/items/${toReorder.id}/reorder`,
    //       payload: {
    //         previousItemId: previousItem.id,
    //       },
    //     });
    //     expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    //   });
    //   describe('Signed In', () => {
    //     it('reorder at same place', async () => {
    //       const actor = await saveMember();
    //       mockAuthenticate(actor);
    //       const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
    //       const toReorder = await testUtils.saveItem({
    //         actor,
    //         parentItem,
    //         item: { order: 10 },
    //       });
    //       const previousItem = await testUtils.saveItem({
    //         actor,
    //         parentItem,
    //         item: { order: 5 },
    //       });
    //       const response = await app.inject({
    //         method: HttpMethod.Patch,
    //         url: `/items/${toReorder.id}/reorder`,
    //         payload: {
    //           previousItemId: previousItem.id,
    //         },
    //       });
    //       expect(response.statusCode).toBe(StatusCodes.OK);
    //       await testUtils.expectOrder(toReorder.id, previousItem.id);
    //     });
    //     it('reorder at beginning', async () => {
    //       const actor = await saveMember();
    //       mockAuthenticate(actor);
    //       const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
    //       const toReorder = await testUtils.saveItem({
    //         actor,
    //         parentItem,
    //         item: { order: 10 },
    //       });
    //       await testUtils.saveItem({
    //         actor,
    //         parentItem,
    //         item: { order: 5 },
    //       });
    //       const response = await app.inject({
    //         method: HttpMethod.Patch,
    //         url: `/items/${toReorder.id}/reorder`,
    //         payload: {},
    //       });
    //       expect(response.statusCode).toBe(StatusCodes.OK);
    //       // should have order smaller than first item
    //       expect(await testUtils.getOrderForItemId(toReorder.id)).toBeLessThan(5);
    //     });
    //     it('reorder at end', async () => {
    //       const actor = await saveMember();
    //       mockAuthenticate(actor);
    //       const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
    //       const toReorder = await testUtils.saveItem({
    //         actor,
    //         parentItem,
    //         item: { order: 10 },
    //       });
    //       // first item
    //       await testUtils.saveItem({
    //         actor,
    //         parentItem,
    //         item: { order: 5 },
    //       });
    //       const previousItem = await testUtils.saveItem({
    //         actor,
    //         parentItem,
    //         item: { order: 15 },
    //       });
    //       const response = await app.inject({
    //         method: HttpMethod.Patch,
    //         url: `/items/${toReorder.id}/reorder`,
    //         payload: {
    //           previousItemId: previousItem.id,
    //         },
    //       });
    //       expect(response.statusCode).toBe(StatusCodes.OK);
    //       await testUtils.expectOrder(toReorder.id, previousItem.id);
    //     });
    //     it('reorder in between', async () => {
    //       const actor = await saveMember();
    //       mockAuthenticate(actor);
    //       const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
    //       const toReorder = await testUtils.saveItem({
    //         actor,
    //         parentItem,
    //         item: { order: 20 },
    //       });
    //       const previousItem = await testUtils.saveItem({
    //         actor,
    //         parentItem,
    //         item: { order: 5 },
    //       });
    //       const afterItem = await testUtils.saveItem({
    //         actor,
    //         parentItem,
    //         item: { order: 15 },
    //       });
    //       const response = await app.inject({
    //         method: HttpMethod.Patch,
    //         url: `/items/${toReorder.id}/reorder`,
    //         payload: {
    //           previousItemId: previousItem.id,
    //         },
    //       });
    //       expect(response.statusCode).toBe(StatusCodes.OK);
    //       await testUtils.expectOrder(toReorder.id, previousItem.id, afterItem.id);
    //     });
    //     it('reorder in root throws', async () => {
    //       const actor = await saveMember();
    //       mockAuthenticate(actor);
    //       const { item: toReorder } = await testUtils.saveItemAndMembership({
    //         member: actor,
    //       });
    //       const { item: previousItem } = await testUtils.saveItemAndMembership({
    //         member: actor,
    //       });
    //       const response = await app.inject({
    //         method: HttpMethod.Patch,
    //         url: `/items/${toReorder.id}/reorder`,
    //         payload: {
    //           previousItemId: previousItem.id,
    //         },
    //       });
    //       expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    //       expect(await testUtils.getOrderForItemId(toReorder.id)).toBeNull();
    //     });
    //   });
  });
});
