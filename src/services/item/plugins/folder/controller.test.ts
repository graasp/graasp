import { faker } from '@faker-js/faker';
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
  PermissionLevel,
} from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app.js';
import { seedFromJson } from '../../../../../test/mocks/seed.js';
import { resolveDependency } from '../../../../di/utils.js';
import { assertIsDefined } from '../../../../utils/assertions.js';
import {
  MemberCannotAccess,
  MemberCannotWriteItem,
  TooManyChildren,
} from '../../../../utils/errors.js';
import { assertIsMember } from '../../../authentication.js';
import { WrongItemTypeError } from '../../errors.js';
import { ItemTestUtils, expectItem } from '../../test/fixtures/items.js';
import { ActionItemService } from '../action/action.service.js';
import { FolderItemService } from './service.js';

const itemMembershipRawRepository = AppDataSource.getRepository(ItemMembership);
const testUtils = new ItemTestUtils();

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
  let actor;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
    actor = null;
  });
  describe('POST /items/folders', () => {
    it('Throws if signed out', async () => {
      const payload = FolderItemFactory();
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items/folders',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let waitForPostCreation: () => Promise<unknown>;
      beforeEach(async () => {
        const folderService = resolveDependency(FolderItemService);
        const actionItemService = resolveDependency(ActionItemService);

        const itemServiceRescaleOrderForParent = jest.spyOn(folderService, 'rescaleOrderForParent');
        const actionItemServicePostPostAction = jest.spyOn(actionItemService, 'postPostAction');

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
        ({ actor } = await seedFromJson());
        mockAuthenticate(actor);

        const payload = FolderItemFactory();

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items/folders',
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);

        // check response value
        const newItem = response.json();
        expectItem(newItem, payload);
        await waitForPostCreation();

        // check item exists in db
        const item = await testUtils.itemRepository.getOne(app.db, newItem.id);
        expect(item?.id).toEqual(newItem.id);

        // a membership is created for this item
        const membership = await itemMembershipRawRepository.findOneBy({
          item: { id: newItem.id },
        });
        expect(membership?.permission).toEqual(PermissionLevel.Admin);

        // order is null for root
        expect(await testUtils.getOrderForItemId(newItem.id)).toBeNull();
      });

      it('Create successfully in parent item', async () => {
        const { items, actor } = await seedFromJson({
          items: [{ children: [{}], memberships: [{ account: 'actor' }] }],
        });
        const [parent, child] = items;
        mockAuthenticate(actor);
        assertIsDefined(actor);
        assertIsMember(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders?parentId=${parent.id}`,
          payload,
        });
        const newItem = response.json();
        expectItem(newItem, payload, actor, parent);
        expect(response.statusCode).toBe(StatusCodes.OK);
        await waitForPostCreation();

        // a membership does not need to be created for item with admin rights
        const nbItemMemberships = await itemMembershipRawRepository.countBy({
          item: { id: newItem.id },
        });
        expect(nbItemMemberships).toEqual(0);

        // add at beginning
        await testUtils.expectOrder(newItem.id, undefined, child.id);
      });

      it('Create successfully in shared parent item', async () => {
        const {
          items: [parent],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Write }] }],
        });
        mockAuthenticate(actor);
        assertIsDefined(actor);
        assertIsMember(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders?parentId=${parent.id}`,
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
          await itemMembershipRawRepository.countBy({
            permission: PermissionLevel.Admin,
            item: { id: newItem.id },
            account: { id: actor.id },
          }),
        ).toEqual(1);
      });

      it('Create successfully with geolocation', async () => {
        const { actor } = await seedFromJson();
        mockAuthenticate(actor);

        assertIsDefined(actor);
        assertIsMember(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders`,
          payload: { ...payload, geolocation: { lat: 1, lng: 2 } },
        });

        const newItem = response.json();
        expectItem(newItem, payload, actor);
        expect(response.statusCode).toBe(StatusCodes.OK);
        await waitForPostCreation();

        expect(
          await AppDataSource.getRepository(ItemGeolocation).countBy({ item: { id: newItem.id } }),
        ).toEqual(1);
      });

      it('Create successfully with language', async () => {
        const { actor } = await seedFromJson();
        mockAuthenticate(actor);
        assertIsDefined(actor);
        assertIsMember(actor);

        const payload = FolderItemFactory({ lang: 'fr' });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders`,
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
        mockAuthenticate(actor);
        assertIsDefined(actor);
        assertIsMember(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders`,
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
        mockAuthenticate(actor);
        assertIsDefined(actor);
        assertIsMember(actor);

        const payload = FolderItemFactory({
          settings: { descriptionPlacement: DescriptionPlacement.ABOVE },
        });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders`,
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
        mockAuthenticate(actor);
        assertIsDefined(actor);
        assertIsMember(actor);

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
          url: `/items/folders`,
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
        mockAuthenticate(actor);
        assertIsDefined(actor);
        assertIsMember(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders`,
          query: { parentId: parentItem.id, previousItemId: previousItem.id },
          payload,
        });

        const newItem = response.json();
        expectItem(newItem, payload, actor);
        expect(response.statusCode).toBe(StatusCodes.OK);
        await waitForPostCreation();

        await testUtils.expectOrder(newItem.id, previousItem.id, afterItem.id);
      });

      it('Create successfully at end', async () => {
        const {
          items: [parentItem, _noise, previousItem],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor' }], children: [{ order: 1 }, { order: 40 }] }],
        });
        mockAuthenticate(actor);
        assertIsDefined(actor);
        assertIsMember(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders`,
          query: { parentId: parentItem.id, previousItemId: previousItem.id },
          payload,
        });

        const newItem = response.json();
        expectItem(newItem, payload, actor);
        expect(response.statusCode).toBe(StatusCodes.OK);
        await waitForPostCreation();

        await testUtils.expectOrder(newItem.id, previousItem.id);
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
        mockAuthenticate(actor);
        assertIsDefined(actor);
        assertIsMember(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders`,
          query: { parentId: parentItem.id, previousItemId: anotherChild.id },
          payload,
        });

        const newItem = response.json();
        expectItem(newItem, payload, actor);
        expect(response.statusCode).toBe(StatusCodes.OK);
        await waitForPostCreation();

        // should be after child, since another child is not valid
        await testUtils.expectOrder(newItem.id, child.id, anotherChild.id);
      });

      it('Throw if geolocation is partial', async () => {
        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders`,
          payload: { ...payload, geolocation: { lat: 1 } },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
        // no item nor geolocation is created
        expect(await testUtils.rawItemRepository.countBy({ name: payload.name })).toEqual(0);

        const response1 = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders`,
          payload: { ...payload, geolocation: { lng: 1 } },
        });

        expect(response1.statusCode).toBe(StatusCodes.BAD_REQUEST);
        // no item nor geolocation is created
        expect(await testUtils.rawItemRepository.countBy({ name: payload.name })).toEqual(0);
      });

      it('Bad request if name is invalid', async () => {
        // by default the item creator use an invalid item type
        const newItem = FolderItemFactory({ name: '' });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items/folders',
          payload: newItem,
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);

        // by default the item creator use an invalid item type
        const newItem1 = FolderItemFactory({ name: ' ' });
        const response1 = await app.inject({
          method: HttpMethod.Post,
          url: '/items/folders',
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
          url: `/items/folders?parentId=${parentId}`,
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Cannot create item in non-existing parent', async () => {
        const { actor } = await seedFromJson();
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const parentId = uuidv4();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders?parentId=${parentId}`,
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
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders?parentId=${parent.id}`,
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
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders?parentId=${parent.id}`,
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
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders?parentId=${parent.id}`,
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
        mockAuthenticate(actor);

        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders?parentId=${parent.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(response.json()).toMatchObject(new WrongItemTypeError(ItemType.DOCUMENT));
      });
    });
  });

  describe('POST /items/folders-with-thumbnail', () => {
    beforeEach(async () => {
      const { actor } = await seedFromJson({ actor: { extra: { lang: 'en' } } });
      mockAuthenticate(actor);
    });
    it('Post item with thumbnail', async () => {
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
        url: `/items/folders-with-thumbnail`,
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

  describe('PATCH /items/folders/:id', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        actor: null,
        items: [{}],
      });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/folders/${item.id}`,
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
          url: `/items/folders/${item.id}`,
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
        mockAuthenticate(actor);

        const payload = {
          lang: 'fr',
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/folders/${item.id}`,
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
        mockAuthenticate(actor);

        const payload = {
          settings: {
            ...item.settings,
            descriptionPlacement: DescriptionPlacement.ABOVE,
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/folders/${item.id}`,
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
          url: `/items/folders/${item.id}`,
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
          url: '/items/folders/invalid-id',
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
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/folders/${item.id}`,
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
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/folders/${item.id}`,
          payload,
        });

        expect(response.json()).toEqual(new MemberCannotWriteItem(item.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });
});
