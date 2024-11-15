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
  MAX_TARGETS_FOR_MODIFY_REQUEST,
  MAX_TREE_LEVELS,
  PermissionLevel,
  buildPathFromIds,
} from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { resolveDependency } from '../../../../di/utils';
import { AppDataSource } from '../../../../plugins/datasource';
import {
  HierarchyTooDeep,
  ItemNotFolder,
  ItemNotFound,
  MemberCannotAccess,
  MemberCannotWriteItem,
  TooManyChildren,
} from '../../../../utils/errors';
import { ItemMembership } from '../../../itemMembership/entities/ItemMembership';
import { saveMember } from '../../../member/test/fixtures/members';
import { Item } from '../../entities/Item';
import { ItemService } from '../../service';
import { ItemTestUtils, expectItem } from '../../test/fixtures/items';
import { saveUntilMaxDescendants } from '../../test/utils';
import { ActionItemService } from '../action/service';
import { ItemGeolocation } from '../geolocation/ItemGeolocation';

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

    describe('Signed In', () => {
      let waitForPostCreation: () => Promise<unknown>;
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);

        const itemService = resolveDependency(ItemService);
        const actionItemService = resolveDependency(ActionItemService);

        const itemServiceRescaleOrderForParent = jest.spyOn(itemService, 'rescaleOrderForParent');
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
        const item = await testUtils.itemRepository.getOne(newItem.id);
        expect(item?.id).toEqual(newItem.id);

        // a membership is created for this item
        const membership = await itemMembershipRawRepository.findOneBy({
          item: { id: newItem.id },
        });
        expect(membership?.permission).toEqual(PermissionLevel.Admin);
        // check some creator properties are not leaked
        expect(newItem.creator.id).toBeTruthy();
        expect(newItem.creator.createdAt).toBeFalsy();

        // order is null for root
        expect(await testUtils.getOrderForItemId(newItem.id)).toBeNull();
      });

      it('Create successfully in parent item', async () => {
        const { item: parent } = await testUtils.saveItemAndMembership({
          member: actor,
        });
        // child
        const child = await testUtils.saveItem({
          actor,
          parentItem: parent,
        });
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
        const member = await saveMember();
        const { item: parent } = await testUtils.saveItemAndMembership({ member });
        await testUtils.saveMembership({
          account: actor,
          item: parent,
          permission: PermissionLevel.Write,
        });
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
        const { item: parentItem } = await testUtils.saveItemAndMembership({
          member: actor,
          item: { lang },
        });
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

      it('Create successfully with empty display name', async () => {
        const payload = FolderItemFactory({ displayName: '' });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders`,
          payload: { ...payload },
        });

        const newItem = response.json();
        expectItem(newItem, payload, actor);
        expect(newItem.displayName).toEqual('');
        expect(response.statusCode).toBe(StatusCodes.OK);
        await waitForPostCreation();

        expect(await AppDataSource.getRepository(Item).countBy({ id: newItem.id })).toEqual(1);
      });

      it('Create successfully with between children', async () => {
        const payload = FolderItemFactory();
        const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
        const previousItem = await testUtils.saveItem({ parentItem, item: { order: 1 } });
        const afterItem = await testUtils.saveItem({ parentItem, item: { order: 2 } });
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
        const payload = FolderItemFactory();
        const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
        // first item noise
        await testUtils.saveItem({ parentItem, item: { order: 1 } });
        const previousItem = await testUtils.saveItem({ parentItem, item: { order: 40 } });
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
        const payload = FolderItemFactory();
        const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
        const child = await testUtils.saveItem({ parentItem, item: { order: 30 } });

        // noise, child in another parent
        const { item: otherParent } = await testUtils.saveItemAndMembership({ member: actor });
        const anotherChild = await testUtils.saveItem({
          parentItem: otherParent,
          item: { order: 100 },
        });

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

      it('Bad request if type is invalid', async () => {
        // by default the item creator use an invalid item type
        const newItem = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items/folders',
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
      it('Cannot create item in non-existing parent', async () => {
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
        const member = await saveMember();
        const { item: parent } = await testUtils.saveItemAndMembership({ member });
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
        const owner = await saveMember();
        const { item: parent } = await testUtils.saveItemAndMembership({
          member: actor,
          creator: owner,
          permission: PermissionLevel.Read,
        });

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
        const { item: parent } = await testUtils.saveItemAndMembership({
          member: actor,
        });
        const payload = FolderItemFactory();

        // save maximum children
        await testUtils.saveItems({
          nb: MAX_NUMBER_OF_CHILDREN,
          parentItem: parent,
          member: actor,
        });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders?parentId=${parent.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual(new TooManyChildren());
      });

      it('Cannot create item if parent is too deep in hierarchy', async () => {
        const payload = FolderItemFactory();
        const { item: parent } = await testUtils.saveItemAndMembership({
          member: actor,
        });
        const currentParent = await saveUntilMaxDescendants(parent, actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders?parentId=${currentParent.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual(new HierarchyTooDeep());
      });

      it('Cannot create inside non-folder item', async () => {
        const { item: parent } = await testUtils.saveItemAndMembership({
          member: actor,
          item: { type: ItemType.DOCUMENT },
        });
        const payload = FolderItemFactory();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/folders?parentId=${parent.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(response.json()).toMatchObject(new ItemNotFolder({ id: parent.id }));
      });
    });
  });

  describe('POST /items/with-thumbnail', () => {
    beforeEach(async () => {
      actor = await saveMember();
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

  describe('PATCH /items/:id', () => {
    it('Throws if signed out', async () => {
      const member = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/folders/${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Update successfully', async () => {
        const { item } = await testUtils.saveItemAndMembership({
          item: {
            type: ItemType.DOCUMENT,
            extra: {
              [ItemType.DOCUMENT]: {
                content: 'content',
              },
            },
          },
          member: actor,
        });
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
          url: `/items/folders/${item.id}`,
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
        const { item } = await testUtils.saveItemAndMembership({
          member: actor,
        });
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
        const { item } = await testUtils.saveItemAndMembership({
          member: actor,
        });
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

      it('Update successfully link settings', async () => {
        const { item } = await testUtils.saveItemAndMembership({
          member: actor,
        });
        const payload = {
          settings: {
            showLinkButton: false,
            showLinkIframe: true,
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/folders/${item.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const newItem = response.json();

        expectItem(newItem, {
          ...item,
          ...payload,
        });
        expect(newItem.settings.showLinkButton).toBe(false);
        expect(newItem.settings.showLinkIframe).toBe(true);
        expect(newItem.settings.hasThumbnail).toBeFalsy();
      });

      it('Update successfully with empty display name', async () => {
        const { item } = await testUtils.saveItemAndMembership({
          member: actor,
          item: { displayName: 'Not empty' },
        });

        const payload = { displayName: '' };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/folders/${item.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const newItem = response.json();
        expect(newItem.displayName).toEqual('');
      });

      it('Filter out bad setting when updating', async () => {
        const BAD_SETTING = { INVALID: 'Not a valid setting' };
        const VALID_SETTING = { descriptionPlacement: DescriptionPlacement.ABOVE };

        const { item } = await testUtils.saveItemAndMembership({
          member: actor,
        });
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
      it('Bad Request if extra is invalid', async () => {
        const payload = {
          name: 'new name',
          extra: { key: 'false' },
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/folders/${uuidv4()}`,
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Cannot update not found item given id', async () => {
        const payload = {
          name: 'new name',
        };
        const id = uuidv4();
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/folders/${id}`,
          payload,
        });

        expect(response.json()).toEqual(new ItemNotFound(id));
        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      });
      it('Cannot update item if does not have membership', async () => {
        const payload = {
          name: 'new name',
        };
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member });

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/folders/${item.id}`,
          payload,
        });

        expect(response.json()).toEqual(new MemberCannotAccess(item.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
      it('Cannot update item if has only read membership', async () => {
        const payload = {
          name: 'new name',
        };
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member });
        await testUtils.saveMembership({ item, account: actor, permission: PermissionLevel.Read });
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
