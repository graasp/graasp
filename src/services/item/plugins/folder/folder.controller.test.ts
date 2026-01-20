import { faker } from '@faker-js/faker';
import { and, eq } from 'drizzle-orm';
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
  PermissionLevel,
} from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import {
  itemGeolocationsTable,
  itemMembershipsTable,
  itemsRawTable,
} from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import {
  ItemNotFolder,
  MemberCannotAccess,
  MemberCannotWriteItem,
  TooManyChildren,
} from '../../../../utils/errors';
import { assertIsMember, assertIsMemberForTest } from '../../../authentication';
import { expectItem } from '../../test/fixtures/items';
import { ItemActionService } from '../action/itemAction.service';
import { FolderItemService } from './folder.service';

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

describe('Folder routes tests', () => {
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

  describe('POST /api/items/folders', () => {
    it('Throws if signed out', async () => {
      const payload = FolderItemFactory();
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/folders',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let waitForPostCreation: () => Promise<unknown>;
      beforeEach(async () => {
        const folderService = resolveDependency(FolderItemService);
        const itemActionService = resolveDependency(ItemActionService);

        const itemServiceRescaleOrderForParent = jest.spyOn(folderService, 'rescaleOrderForParent');
        const itemActionServicePostPostAction = jest.spyOn(itemActionService, 'postPostAction');

        // The API's is still working with the database after responding to an item post request,
        // so we need to wait for the work to be done so we don't have flacky deadlock exceptions.
        waitForPostCreation = async () => {
          return await waitForExpect(async () => {
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
          url: '/api/items/folders',
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
        expect(item?.id).toEqual(newItem.id);

        // a membership is created for this item
        const membership = await db.query.itemMembershipsTable.findFirst({
          where: eq(itemMembershipsTable.itemPath, newItem.path),
        });
        expect(membership?.permission).toEqual(PermissionLevel.Admin);

        // order is null for root
        const savedItem = await db.query.itemsRawTable.findFirst({
          where: eq(itemsRawTable.id, newItem.id),
        });
        assertIsDefined(savedItem);
        expect(savedItem.order).toBeNull();
      });

      it('Create successfully in parent item', async () => {
        const { items, actor } = await seedFromJson({
          items: [{ children: [{ order: 20 }], memberships: [{ account: 'actor' }] }],
        });
        const [parent, child] = items;
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/folders?parentId=${parent.id}`,
          payload,
        });
        const newItem = response.json();
        expectItem(newItem, payload, actor, parent);
        expect(response.statusCode).toBe(StatusCodes.OK);
        await waitForPostCreation();

        // a membership does not need to be created for item with admin rights
        const nbItemMemberships = await db.query.itemMembershipsTable.findMany({
          where: eq(itemMembershipsTable.itemPath, newItem.path),
        });
        expect(nbItemMemberships).toHaveLength(0);

        // add at beginning, before current child
        const savedItem = await db.query.itemsRawTable.findFirst({
          where: eq(itemsRawTable.id, newItem.id),
        });
        assertIsDefined(savedItem);
        expect(savedItem.order).toBeLessThan(child.order!);
      });

      it('Create successfully in shared parent item', async () => {
        const {
          items: [parent],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Write }] }],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/folders?parentId=${parent.id}`,
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
          await db.query.itemMembershipsTable.findMany({
            where: and(
              eq(itemMembershipsTable.itemPath, newItem.path),
              eq(itemMembershipsTable.permission, PermissionLevel.Admin),
              eq(itemMembershipsTable.accountId, actor.id),
            ),
          }),
        ).toHaveLength(1);
      });

      it('Create successfully with geolocation', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/folders',
          payload: { ...payload, geolocation: { lat: 1, lng: 2 } },
        });

        const newItem = response.json();
        expectItem(newItem, payload, actor);
        expect(response.statusCode).toBe(StatusCodes.OK);
        await waitForPostCreation();

        expect(
          await db.query.itemGeolocationsTable.findMany({
            where: eq(itemGeolocationsTable.itemPath, newItem.path),
          }),
        ).toHaveLength(1);
      });

      it('Create successfully with language', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory({ lang: 'fr' });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/folders',
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
          items: [parentItem],
          actor,
        } = await seedFromJson({
          items: [{ lang, memberships: [{ account: 'actor' }] }],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/folders',
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
        assertIsMember(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory({
          settings: { descriptionPlacement: DescriptionPlacement.ABOVE },
        });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/folders',
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
        assertIsMember(actor);
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
          url: '/api/items/folders',
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
          items: [parentItem, previousItem, afterItem],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor' }], children: [{ order: 1 }, { order: 2 }] }],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/folders',
          query: { parentId: parentItem.id, previousItemId: previousItem.id },
          payload,
        });

        const newItem = response.json();
        expectItem(newItem, payload, actor);
        expect(response.statusCode).toBe(StatusCodes.OK);
        await waitForPostCreation();

        const savedItem = await db.query.itemsRawTable.findFirst({
          where: eq(itemsRawTable.id, newItem.id),
        });
        assertIsDefined(savedItem);
        expect(savedItem.order).toBeGreaterThan(previousItem.order!);
        expect(savedItem.order).toBeLessThan(afterItem.order!);
      });

      it('Create successfully at end', async () => {
        const {
          items: [parentItem, _noise, previousItem],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor' }], children: [{ order: 1 }, { order: 40 }] }],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/folders',
          query: { parentId: parentItem.id, previousItemId: previousItem.id },
          payload,
        });

        const newItem = response.json();
        expectItem(newItem, payload, actor);
        expect(response.statusCode).toBe(StatusCodes.OK);
        await waitForPostCreation();

        const savedItem = await db.query.itemsRawTable.findFirst({
          where: eq(itemsRawTable.id, newItem.id),
        });
        assertIsDefined(savedItem);
        expect(savedItem.order).toBeGreaterThan(previousItem.order!);
      });

      it('Create successfully after invalid child adds at end', async () => {
        const {
          items: [parentItem, child, _noiseParent, anotherChild],
          actor,
        } = await seedFromJson({
          items: [
            { memberships: [{ account: 'actor' }], children: [{ order: 30 }] },
            // noise
            { memberships: [{ account: 'actor' }], children: [{ order: 100 }] },
          ],
        });
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/folders',
          query: { parentId: parentItem.id, previousItemId: anotherChild.id },
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const newItem = response.json();
        expectItem(newItem, payload, actor);
        await waitForPostCreation();

        // should be after child, since another child is not valid
        const savedItem = await db.query.itemsRawTable.findFirst({
          where: eq(itemsRawTable.id, newItem.id),
        });
        assertIsDefined(savedItem);
        assertIsDefined(child.order);
        assertIsDefined(anotherChild.order);
        expect(savedItem.order).toBeGreaterThan(child.order);
        // is smaller than another child because it is not in the same parent
        expect(savedItem.order).toBeLessThan(anotherChild.order);
      });

      it('Throw if geolocation is partial', async () => {
        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/folders',
          payload: { ...payload, geolocation: { lat: 1 } },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
        // no item nor geolocation is created
        expect(
          await db.query.itemsRawTable.findMany({
            where: eq(itemsRawTable.name, payload.name),
          }),
        ).toHaveLength(0);

        const response1 = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/folders',
          payload: { ...payload, geolocation: { lng: 1 } },
        });

        expect(response1.statusCode).toBe(StatusCodes.BAD_REQUEST);
        // no item nor geolocation is created
        expect(
          await db.query.itemsRawTable.findMany({
            where: eq(itemsRawTable.name, payload.name),
          }),
        ).toHaveLength(0);
      });

      it('Bad request if name is invalid', async () => {
        // by default the item creator use an invalid item type
        const newItem = FolderItemFactory({ name: '' });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/folders',
          payload: newItem,
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);

        // by default the item creator use an invalid item type
        const newItem1 = FolderItemFactory({ name: ' ' });
        const response1 = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/folders',
          payload: newItem1,
        });
        expect(response1.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response1.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Bad request if parentId id is invalid', async () => {
        const payload = FolderItemFactory();
        const parentId = 'invalid-id';
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/folders?parentId=${parentId}`,
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Cannot create item in non-existing parent', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const parentId = uuidv4();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/folders?parentId=${parentId}`,
          payload,
        });

        expect(response.statusMessage).toEqual('Not Found');
        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      });

      it('Cannot create item if member does not have membership on parent', async () => {
        const {
          items: [parent],
          actor,
        } = await seedFromJson({
          items: [{}],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/folders?parentId=${parent.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual(new MemberCannotAccess(parent.id));
      });

      it('Cannot create item if member can only read parent', async () => {
        const {
          items: [parent],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Read }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/folders?parentId=${parent.id}`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual(new MemberCannotWriteItem(parent.id));
      });

      it('Cannot create item if parent item has too many children', async () => {
        const {
          items: [parent],
          actor,
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor' }],

              // save maximum children
              children: Array.from({ length: MAX_NUMBER_OF_CHILDREN }, () => ({})),
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/folders?parentId=${parent.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual(new TooManyChildren());
      });

      it('Cannot create inside non-folder item', async () => {
        const {
          items: [parent],
          actor,
        } = await seedFromJson({
          items: [
            {
              type: ItemType.DOCUMENT,
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/folders?parentId=${parent.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(response.json()).toMatchObject(new ItemNotFolder(parent));
      });
    });
  });

  describe('POST /api/items/folders-with-thumbnail', () => {
    it('Post item with thumbnail', async () => {
      const { actor } = await seedFromJson({ actor: { extra: { lang: 'en' } } });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);
      const imageStream = fs.createReadStream(
        path.resolve(__dirname, '../../test/fixtures/image.png'),
      );
      const itemName = 'Test Item';
      const payload = new FormData();
      payload.append('name', itemName);
      payload.append('type', ItemType.FOLDER);
      payload.append('description', '');
      payload.append('file', imageStream);
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/folders-with-thumbnail`,
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

  describe('PATCH /api/items/folders/:id', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        actor: null,
        items: [{}],
      });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/api/items/folders/${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Update successfully', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor' }],
              extra: {
                [ItemType.FOLDER]: {},
              },
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
          extra: {
            [ItemType.FOLDER]: {},
          },
          settings: {
            hasThumbnail: true,
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/folders/${item.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        // this test a bit how we deal with extra: it replaces existing keys
        expectItem(response.json(), {
          ...item,
          ...payload,
          extra: {
            folder: {},
          },
        });
      });

      it('Update successfully new language', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          lang: 'fr',
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/folders/${item.id}`,
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
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          settings: {
            ...item.settings,
            descriptionPlacement: DescriptionPlacement.ABOVE,
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/folders/${item.id}`,
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

      it('Filter out bad setting when updating', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
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
          url: `/api/items/folders/${item.id}`,
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
        const payload = {
          name: 'new name',
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: '/api/items/folders/invalid-id',
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Cannot update item if does not have membership', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [{}],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/folders/${item.id}`,
          payload,
        });

        expect(response.json()).toEqual(new MemberCannotAccess(item.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
      it('Cannot update item if has only read membership', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Read }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/folders/${item.id}`,
          payload,
        });

        expect(response.json()).toEqual(new MemberCannotWriteItem(item.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });

  describe('PATCH /api/items/folders/:id/convert', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        actor: null,
        items: [{}],
      });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/api/items/folders/${item.id}/convert`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Switch successfully', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor' }],
              extra: {
                [ItemType.FOLDER]: {},
              },
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/folders/${item.id}/convert`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        // this test a bit how we deal with extra: it replaces existing keys
        expectItem(response.json(), {
          ...item,
          extra: {
            folder: { isCapsule: true },
          },
        });
      });

      it('Bad request if id is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: '/api/items/folders/invalid-id/convert',
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Cannot update item if does not have membership', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [{}],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/folders/${item.id}/convert`,
        });

        expect(response.json()).toEqual(new MemberCannotAccess(item.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });

      it('Cannot update if item is not a folder', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [{ type: ItemType.DOCUMENT }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/folders/${item.id}/convert`,
        });

        expect(response.json()).toEqual(new ItemNotFolder({ id: item.id }));
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Cannot update item if has only read membership', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Read }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/folders/${item.id}/convert`,
        });

        expect(response.json()).toEqual(new MemberCannotWriteItem(item.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });
});
