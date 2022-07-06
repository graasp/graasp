import { v4 as uuidv4 } from 'uuid';
import qs from 'qs';
import build from './app';
import { getDummyItem, LOTS_OF_ITEMS } from './fixtures/items';
import { PermissionLevel } from '../src/services/item-memberships/interfaces/item-membership';
import * as MEMBERS_FIXTURES from './fixtures/members';
import { buildPathFromId } from './utils';
import {
  HierarchyTooDeep,
  InvalidMoveTarget,
  ItemNotFound,
  MemberCannotAccess,
  MemberCannotWriteItem,
  TooManyChildren,
  TooManyDescendants,
} from '../src/util/graasp-error';

import * as baseItemMembershipModule from '../src/services/item-memberships/base-item-membership';
import { mockedBaseItemMembership } from './mocks/base-item-membership';
import {
  mockItemMembershipServiceGetForMemberAtItem,
  mockItemMembershipServiceCreate,
  mockItemServiceCreate,
  mockItemServiceDelete,
  mockItemServiceGet,
  mockItemServiceGetDescendants,
  mockItemServiceGetNumberOfChildren,
  mockItemServiceGetNumberOfDescendants,
  mockItemServiceGetNumberOfLevelsToFarthestChild,
  mockItemServiceGetOwn,
  mockItemServiceGetSharedWith,
  mockItemServiceMove,
  mockItemServiceUpdate,
  mockActionServiceCreate,
} from './mocks';
import {
  MAX_DESCENDANTS_FOR_COPY,
  MAX_DESCENDANTS_FOR_DELETE,
  MAX_DESCENDANTS_FOR_MOVE,
  MAX_NUMBER_OF_CHILDREN,
  MAX_TREE_LEVELS,
} from '../src/util/config';
import { buildMembership } from './fixtures/memberships';
import { HTTP_METHODS } from './fixtures/utils';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { MULTIPLE_ITEMS_LOADING_TIME } from './constants';
import { ITEM_TYPES } from '../src/services/items/constants/constants';

// mock base item membership to detect calls
const baseItemMembershipMock = jest.spyOn(baseItemMembershipModule, 'BaseItemMembership');
baseItemMembershipMock.mockImplementation(() => mockedBaseItemMembership);

// mock database, auth and decorator plugins
jest.mock('../src/plugins/database');
jest.mock('../src/plugins/auth/auth');
jest.mock('../src/plugins/decorator');

// we want to check saved actions run sucessfully if they are enabled
if (process.env.SAVE_ACTIONS) {
  mockActionServiceCreate();
}

describe('Item routes tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /items', () => {
    it('Create successfully', async () => {
      const payload = getDummyItem({ type: ITEM_TYPES.FOLDER });
      const memberships = [
        buildMembership({ path: payload.path, permission: PermissionLevel.Admin }),
      ];
      // mock sql requests
      mockItemServiceCreate();
      mockItemMembershipServiceGetForMemberAtItem(memberships);

      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: '/items',
        payload,
      });

      const newItem = response.json();
      expect(newItem.name).toEqual(payload.name);
      expect(newItem.description).toEqual(payload.description);
      expect(newItem.creator).toEqual(MEMBERS_FIXTURES.ACTOR.id);
      expect(newItem.path).toEqual(buildPathFromId(newItem.id));
      expect(newItem.extra).toEqual(payload.extra);
      expect(newItem.type).toEqual(payload.type);
      expect(response.statusCode).toBe(StatusCodes.OK);

      // a membership is created for this item
      expect(baseItemMembershipMock).toHaveBeenCalled();
      app.close();
    });
    it('Create successfully in parent item', async () => {
      const payload = getDummyItem({ type: ITEM_TYPES.FOLDER });
      const parent = getDummyItem();
      const items = [payload, parent];
      const memberships = [
        buildMembership({ path: payload.path, permission: PermissionLevel.Admin }),
        buildMembership({ path: parent.path, permission: PermissionLevel.Admin }),
      ];
      // mock sql requests
      mockItemServiceCreate();
      mockItemServiceGetNumberOfChildren();
      mockItemServiceGet(items);
      mockItemMembershipServiceGetForMemberAtItem(memberships);

      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items?parentId=${parent.id}`,
        payload,
      });

      const newItem = response.json();
      expect(newItem.name).toEqual(payload.name);
      expect(newItem.description).toEqual(payload.description);
      expect(newItem.creator).toEqual(MEMBERS_FIXTURES.ACTOR.id);
      expect(newItem.path).toContain(buildPathFromId(newItem.id));
      expect(newItem.path).toContain(buildPathFromId(parent.id));
      expect(newItem.extra).toEqual(payload.extra);
      expect(newItem.type).toEqual(payload.type);
      expect(response.statusCode).toBe(StatusCodes.OK);
      // a membership does not need to be created for this item
      expect(baseItemMembershipMock).not.toHaveBeenCalled();
      app.close();
    });
    it('Create successfully in shared parent item', async () => {
      const payload = getDummyItem({ type: ITEM_TYPES.FOLDER });
      const parent = getDummyItem({ creator: MEMBERS_FIXTURES.BOB.id });
      const memberships = [
        buildMembership({ path: payload.path, permission: PermissionLevel.Admin }),
        buildMembership({ path: parent.path, permission: PermissionLevel.Write }),
      ];
      mockItemServiceCreate();
      mockItemServiceGetNumberOfChildren();
      mockItemServiceGet([parent]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);

      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items?parentId=${parent.id}`,
        payload,
      });

      const newItem = response.json();
      expect(newItem.name).toEqual(payload.name);
      expect(newItem.description).toEqual(payload.description);
      expect(newItem.creator).toEqual(MEMBERS_FIXTURES.ACTOR.id);
      expect(newItem.path).toContain(buildPathFromId(newItem.id));
      expect(newItem.path).toContain(buildPathFromId(parent.id));
      expect(newItem.extra).toEqual(payload.extra);
      expect(newItem.type).toEqual(payload.type);
      expect(response.statusCode).toBe(StatusCodes.OK);
      // a membership is created for this item
      expect(baseItemMembershipMock).toHaveBeenCalled();
      app.close();
    });
    it('Bad request if name is invalid', async () => {
      const app = await build();
      // by default the item creator use an invalid item type
      const newItem = getDummyItem({ name: '' });
      const response = await app.inject({
        method: 'POST',
        url: '/items',
        payload: newItem,
      });
      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);

      // by default the item creator use an invalid item type
      const newItem1 = getDummyItem({ name: ' ' });
      const response1 = await app.inject({
        method: 'POST',
        url: '/items',
        payload: newItem1,
      });
      expect(response1.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response1.statusCode).toBe(StatusCodes.BAD_REQUEST);

      app.close();
    });
    it('Bad request if type is invalid', async () => {
      const app = await build();
      // by default the item creator use an invalid item type
      const newItem = getDummyItem({ type: 'invalid-type' });
      const response = await app.inject({
        method: 'POST',
        url: '/items',
        payload: newItem,
      });
      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });
    it('Bad request if parentId id is invalid', async () => {
      const app = await build();
      const payload = getDummyItem({ type: ITEM_TYPES.FOLDER });
      const parentId = 'invalid-id';
      const response = await app.inject({
        method: 'POST',
        url: `/items?parentId=${parentId}`,
        payload,
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });
    it('Cannot create item in non-existing parent', async () => {
      const app = await build();
      const payload = getDummyItem({ type: ITEM_TYPES.FOLDER });
      const parentId = uuidv4();
      const response = await app.inject({
        method: 'POST',
        url: `/items?parentId=${parentId}`,
        payload,
      });

      expect(response.statusMessage).toEqual('Not Found');
      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      app.close();
    });
    it('Cannot create item if member does not have membership on parent', async () => {
      const app = await build();
      const payload = getDummyItem({ type: ITEM_TYPES.FOLDER });
      const parent = getDummyItem({ creator: MEMBERS_FIXTURES.BOB.id });
      mockItemServiceGet([payload, parent]);
      const response = await app.inject({
        method: 'POST',
        url: `/items?parentId=${parent.id}`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(response.json()).toEqual(new MemberCannotAccess(parent.id));
      app.close();
    });
    it('Cannot create item if member can only read parent', async () => {
      const app = await build();
      const payload = getDummyItem({ type: ITEM_TYPES.FOLDER });
      const parent = getDummyItem({ creator: MEMBERS_FIXTURES.BOB.id });
      const memberships = [
        buildMembership({ path: payload.path, permission: PermissionLevel.Admin }),
        buildMembership({ path: parent.path, permission: PermissionLevel.Read }),
      ];
      mockItemServiceGet([payload, parent]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      const response = await app.inject({
        method: 'POST',
        url: `/items?parentId=${parent.id}`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(response.json()).toEqual(new MemberCannotWriteItem(parent.id));
      app.close();
    });
    it('Cannot create item if parent item has too many children', async () => {
      const app = await build();
      const payload = getDummyItem({ type: ITEM_TYPES.FOLDER });
      const parent = getDummyItem({ type: ITEM_TYPES.FOLDER });
      const memberships = [
        buildMembership({ path: payload.path, permission: PermissionLevel.Admin }),
        buildMembership({ path: parent.path, permission: PermissionLevel.Write }),
      ];
      mockItemServiceGet([payload, parent]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetNumberOfChildren(async () => MAX_NUMBER_OF_CHILDREN + 1);
      const response = await app.inject({
        method: 'POST',
        url: `/items?parentId=${parent.id}`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(response.json()).toEqual(new TooManyChildren());
      app.close();
    });
    it('Cannot create item if parent is too deep in hierarchy', async () => {
      const app = await build();
      const payload = getDummyItem({ type: ITEM_TYPES.FOLDER });
      const parentPath = `${uuidv4()}.${uuidv4()}.${uuidv4()}.${uuidv4()}.${uuidv4()}.${uuidv4()}.${uuidv4()}.${uuidv4()}.${uuidv4()}.${uuidv4()}.${uuidv4()}.${uuidv4()}.${uuidv4()}.${uuidv4()}.${uuidv4()}.${uuidv4()}.${uuidv4()}.${uuidv4()}.${uuidv4()}.${uuidv4()}.${uuidv4()}.`;
      const parent = getDummyItem({ parentPath });
      const memberships = [
        buildMembership({ path: payload.path, permission: PermissionLevel.Admin }),
        buildMembership({ path: parent.path, permission: PermissionLevel.Write }),
      ];
      mockItemServiceGet([payload, parent]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetNumberOfChildren();
      const response = await app.inject({
        method: 'POST',
        url: `/items?parentId=${parent.id}`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(response.json()).toEqual(new HierarchyTooDeep());
      app.close();
    });
  });
  describe('GET /items/:id', () => {
    it('Returns successfully', async () => {
      const app = await build();
      const item = getDummyItem();
      const memberships = [buildMembership({ path: item.path, permission: PermissionLevel.Admin })];
      mockItemServiceGet([item]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: `/items/${item.id}`,
      });

      expect(response.json()).toEqual(item);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Bad Request for invalid id', async () => {
      const app = await build();

      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: '/items/invalid-id',
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });
    it('Not found for missing item given id', async () => {
      const app = await build();
      const id = uuidv4();
      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: `/items/${id}`,
      });

      expect(response.json()).toEqual(new ItemNotFound(id));
      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      app.close();
    });
    it('Cannot get item if have no membership', async () => {
      const item = getDummyItem({ creator: MEMBERS_FIXTURES.BOB.id });
      mockItemServiceGet([item]);
      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: `/items/${item.id}`,
      });

      expect(response.json()).toEqual(new MemberCannotAccess(item.id));
      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      app.close();
    });
  });
  // get many items
  describe('GET /items?id=<id>', () => {
    it('Returns successfully', async () => {
      const items = [
        getDummyItem({ type: ITEM_TYPES.FOLDER }),
        getDummyItem({ type: ITEM_TYPES.FOLDER }),
        getDummyItem({ type: ITEM_TYPES.FOLDER }),
      ];
      const memberships = [
        buildMembership({ path: items[0].path, permission: PermissionLevel.Admin }),
        buildMembership({ path: items[1].path, permission: PermissionLevel.Admin }),
        buildMembership({ path: items[2].path, permission: PermissionLevel.Admin }),
      ];
      mockItemServiceGet(items);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      const app = await build();

      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: `/items?${qs.stringify({ id: items.map(({ id }) => id) }, { arrayFormat: 'repeat' })}`,
      });

      expect(response.json()).toEqual(items);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Returns one item successfully for valid item', async () => {
      const app = await build();
      const item = getDummyItem();
      const memberships = [buildMembership({ path: item.path, permission: PermissionLevel.Admin })];
      mockItemServiceGet([item]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: `/items?${qs.stringify({ id: [item.id] }, { arrayFormat: 'repeat' })}`,
      });

      expect(response.json()).toEqual([item]);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Bad request for one invalid item', async () => {
      const app = await build();
      const items = [getDummyItem(), { id: 'invalid-id' }];

      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: `/items?${qs.stringify({ id: items.map(({ id }) => id) }, { arrayFormat: 'repeat' })}`,
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });
    it('Returns one error for one missing item', async () => {
      const missingId = uuidv4();
      const items = [
        getDummyItem({ type: ITEM_TYPES.FOLDER }),
        getDummyItem({ type: ITEM_TYPES.FOLDER }),
      ];
      const memberships = [
        buildMembership({ path: items[0].path, permission: PermissionLevel.Admin }),
        buildMembership({ path: items[1].path, permission: PermissionLevel.Admin }),
      ];
      mockItemServiceGet(items);
      mockItemMembershipServiceGetForMemberAtItem(memberships);

      const app = await build();

      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: `/items?${qs.stringify(
          { id: [items.map(({ id }) => id), missingId] },
          { arrayFormat: 'repeat' },
        )}`,
      });

      expect(response.json()).toEqual([...items, new ItemNotFound(missingId)]);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
  });
  describe('GET /items/own', () => {
    it('Returns successfully', async () => {
      const items = [getDummyItem(), getDummyItem(), getDummyItem()];
      mockItemServiceGetOwn(items);

      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: '/items/own',
      });

      expect(response.json()).toEqual(items);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
  });
  describe('GET /items/shared-with', () => {
    it('Returns successfully', async () => {
      const items = [
        getDummyItem({ creator: MEMBERS_FIXTURES.BOB.id }),
        getDummyItem({ creator: MEMBERS_FIXTURES.BOB.id }),
        getDummyItem({ creator: MEMBERS_FIXTURES.BOB.id }),
      ];
      mockItemServiceGetSharedWith(items);
      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: '/items/shared-with',
      });

      expect(response.json()).toEqual(items);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Returns successfully with one permission filter', async () => {
      const items = [
        getDummyItem({ creator: MEMBERS_FIXTURES.BOB.id }),
        getDummyItem({ creator: MEMBERS_FIXTURES.BOB.id }),
        getDummyItem({ creator: MEMBERS_FIXTURES.BOB.id }),
      ];
      mockItemServiceGetSharedWith(items);
      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: '/items/shared-with?permission=read',
      });

      expect(response.json()).toEqual(items);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Returns successfully with two permission filters', async () => {
      const items = [
        getDummyItem({ creator: MEMBERS_FIXTURES.BOB.id }),
        getDummyItem({ creator: MEMBERS_FIXTURES.BOB.id }),
        getDummyItem({ creator: MEMBERS_FIXTURES.BOB.id }),
      ];
      mockItemServiceGetSharedWith(items);
      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: '/items/shared-with?permission=admin&permission=write',
      });

      expect(response.json()).toEqual(items);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
  });
  describe('GET /items/:id/children', () => {
    it('Returns successfully', async () => {
      const item = getDummyItem();
      const children = [getDummyItem(), getDummyItem()];
      const memberships = [buildMembership({ path: item.path, permission: PermissionLevel.Admin })];
      mockItemServiceGet([item]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetDescendants(async () => children);
      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: `/items/${item.id}/children`,
      });

      expect(response.json()).toEqual(children);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Returns successfully empty children', async () => {
      const item = getDummyItem({ type: ITEM_TYPES.FOLDER });
      const memberships = [buildMembership({ path: item.path, permission: PermissionLevel.Admin })];
      mockItemServiceGet([item]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetDescendants(async () => []);
      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: `/items/${item.id}/children`,
      });

      expect(response.json()).toEqual([]);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Returns ordered children', async () => {
      const children = [
        getDummyItem({ type: ITEM_TYPES.FOLDER }),
        getDummyItem({ type: ITEM_TYPES.FOLDER }),
        getDummyItem({ type: ITEM_TYPES.FOLDER }),
      ];
      const childrenOrder = children.reverse();
      const item = getDummyItem({
        type: ITEM_TYPES.FOLDER,
        extra: { folder: { childrenOrder: childrenOrder.map(({ id }) => id) } },
      });
      const memberships = [buildMembership({ path: item.path, permission: PermissionLevel.Admin })];
      mockItemServiceGet([item]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetDescendants(async () => children);

      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: `/items/${item.id}/children?ordered=true`,
      });

      expect(response.json()).toEqual(childrenOrder);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Returns ordered successfully even without order defined', async () => {
      const item = getDummyItem();
      const children = LOTS_OF_ITEMS;
      const memberships = [buildMembership({ path: item.path, permission: PermissionLevel.Admin })];
      mockItemServiceGet([item]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetDescendants(async () => children);
      const app = await build();

      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: `/items/${item.id}/children?ordered=true`,
      });

      expect(response.json()).toEqual(children);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Bad Request for invalid id', async () => {
      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: '/items/invalid-id/children',
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });
    it('Cannot get children from unexisting item', async () => {
      const app = await build();
      const id = uuidv4();
      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: `/items/${id}/children`,
      });

      expect(response.json()).toEqual(new ItemNotFound(id));
      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      app.close();
    });
    it('Cannot get children if does not have membership on parent', async () => {
      const item = getDummyItem({ creator: MEMBERS_FIXTURES.BOB.id });
      mockItemServiceGet([item]);
      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: `/items/${item.id}/children`,
      });

      expect(response.json()).toEqual(new MemberCannotAccess(item.id));
      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      app.close();
    });
  });
  describe('PATCH /items/:id', () => {
    it('Update successfully', async () => {
      const item = getDummyItem({ type: ITEM_TYPES.FOLDER, extra: { [ITEM_TYPES.FOLDER]: {} } });
      const memberships = [buildMembership({ path: item.path, permission: PermissionLevel.Admin })];
      const payload = {
        name: 'new name',
        description: 'a cool description',
        extra: { folder: { childrenOrder: [uuidv4(), uuidv4()] } },
      };
      mockItemServiceGet([item]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceUpdate([item]);
      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.PATCH,
        url: `/items/${item.id}`,
        payload,
      });

      // this test a bit how we deal with extra: it replaces existing keys
      expect(response.json()).toEqual({ ...item, ...payload });
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Bad request if id is invalid', async () => {
      const app = await build();
      const payload = {
        name: 'new name',
      };
      const response = await app.inject({
        method: HTTP_METHODS.PATCH,
        url: '/items/invalid-id',
        payload,
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });
    it('Bad Request if extra is invalid', async () => {
      const app = await build();
      const payload = {
        name: 'new name',
        extra: { invalid: 'content' },
      };
      const id = getDummyItem().id;
      const response = await app.inject({
        method: HTTP_METHODS.PATCH,
        url: `/items/${id}`,
        payload,
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });
    it('Cannot update undefined item given id', async () => {
      const payload = {
        name: 'new name',
      };
      const id = uuidv4();
      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.PATCH,
        url: `/items/${id}`,
        payload,
      });

      expect(response.json()).toEqual(new ItemNotFound(id));
      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      app.close();
    });
    it('Cannot update item if does not have membership', async () => {
      const payload = {
        name: 'new name',
      };
      const item = getDummyItem({ creator: MEMBERS_FIXTURES.BOB.id });
      mockItemServiceGet([item]);
      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.PATCH,
        url: `/items/${item.id}`,
        payload,
      });

      expect(response.json()).toEqual(new MemberCannotAccess(item.id));
      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      app.close();
    });
    it('Cannot update item if has only read membership', async () => {
      const payload = {
        name: 'new name',
      };
      const item = getDummyItem({ creator: MEMBERS_FIXTURES.BOB.id });
      const memberships = [buildMembership({ path: item.path, permission: PermissionLevel.Read })];
      mockItemServiceGet([item]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.PATCH,
        url: `/items/${item.id}`,
        payload,
      });

      expect(response.json()).toEqual(new MemberCannotWriteItem(item.id));
      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      app.close();
    });
  });
  // update many items
  describe('PATCH /items', () => {
    it('Update successfully', async () => {
      const items = [getDummyItem(), getDummyItem(), getDummyItem()];
      const memberships = [
        buildMembership({ path: items[0].path, permission: PermissionLevel.Admin }),
        buildMembership({ path: items[1].path, permission: PermissionLevel.Admin }),
        buildMembership({ path: items[2].path, permission: PermissionLevel.Admin }),
      ];
      const payload = {
        name: 'new name',
      };
      mockItemServiceGet(items);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceUpdate(items);
      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.PATCH,
        url: `/items?${qs.stringify({ id: items.map(({ id }) => id) }, { arrayFormat: 'repeat' })}`,
        payload,
      });

      expect(response.json()).toEqual(items.map((item) => ({ ...item, ...payload })));
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Update successfully with one error for missing item', async () => {
      const missingItemId = uuidv4();
      const items = [getDummyItem(), getDummyItem()];
      const memberships = [
        buildMembership({ path: items[0].path, permission: PermissionLevel.Admin }),
        buildMembership({ path: items[1].path, permission: PermissionLevel.Admin }),
      ];
      mockItemServiceGet(items);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceUpdate(items);

      const app = await build();
      const payload = {
        name: 'new name',
      };
      const response = await app.inject({
        method: HTTP_METHODS.PATCH,
        url: `/items?${qs.stringify(
          { id: [...items.map(({ id }) => id), missingItemId] },
          { arrayFormat: 'repeat' },
        )}`,
        payload,
      });

      const content = response.json();
      for (const item of content.slice(0, -1)) {
        expect(item).toEqual(expect.objectContaining(payload));
      }
      expect(content[content.length - 1]).toEqual(new ItemNotFound(missingItemId));
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Return 202 for a lof of items', async () => {
      const items = LOTS_OF_ITEMS;
      const memberships = items.map(({ path }) =>
        buildMembership({ path, permission: PermissionLevel.Admin }),
      );
      const ids = items.map(({ id }) => id);
      const payload = {
        name: 'new name',
      };
      mockItemServiceGet(items);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceUpdate(items);

      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.PATCH,
        url: `/items?${qs.stringify({ id: ids }, { arrayFormat: 'repeat' })}`,
        payload,
      });

      expect(response.json()).toEqual(ids);
      expect(response.statusCode).toBe(202);
      app.close();
    });
    it('Bad Request for one invalid id', async () => {
      const app = await build();
      const payload = {
        name: 'new name',
      };
      const response = await app.inject({
        method: HTTP_METHODS.PATCH,
        url: `/items?${qs.stringify(
          { id: [getDummyItem().id, 'invalid-id'] },
          { arrayFormat: 'repeat' },
        )}`,
        payload,
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });
    it('Bad Request for invalid extra', async () => {
      const app = await build();
      const items = [getDummyItem(), getDummyItem()];
      const payload = {
        name: 'new name',
        extra: { some: 'content' },
      };
      const response = await app.inject({
        method: HTTP_METHODS.PATCH,
        url: `/items?${qs.stringify({ id: items.map(({ id }) => id) }, { arrayFormat: 'repeat' })}`,
        payload,
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });
  });
  describe('DELETE /items/:id', () => {
    it('Delete successfully', async () => {
      const item = getDummyItem();
      const memberships = [buildMembership({ path: item.path, permission: PermissionLevel.Admin })];
      mockItemServiceGet([item]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetDescendants();
      mockItemServiceDelete([item]);
      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.DELETE,
        url: `/items/${item.id}`,
      });

      expect(response.json()).toEqual(item);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Delete successfully with children', async () => {
      // mock item service delete to detect calls
      const item = getDummyItem();
      const memberships = [buildMembership({ path: item.path, permission: PermissionLevel.Admin })];
      const children = [getDummyItem(), getDummyItem()];
      mockItemServiceGet([item]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetDescendants(async () => children);
      const mockDelete = mockItemServiceDelete([item, ...children]);
      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.DELETE,
        url: `/items/${item.id}`,
      });

      expect(response.json()).toEqual(item);
      expect(response.statusCode).toBe(StatusCodes.OK);
      // delete children and self
      expect(mockDelete).toHaveBeenCalledTimes(children.length + 1);
      app.close();
    });
    it('Cannot delete too many descendants', async () => {
      const item = getDummyItem();
      const memberships = [buildMembership({ path: item.path, permission: PermissionLevel.Admin })];
      const children = Array.from({ length: MAX_DESCENDANTS_FOR_DELETE + 1 }, () => item);
      mockItemServiceGet([item]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetDescendants(async () => children);
      mockItemServiceDelete([item, ...children]);
      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.DELETE,
        url: `/items/${item.id}`,
      });

      expect(response.json()).toEqual(new TooManyDescendants(item.id));
      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      app.close();
    });
  });
  // delete many items
  describe('DELETE /items', () => {
    it('Delete successfully', async () => {
      const items = [getDummyItem(), getDummyItem()];
      const memberships = items.map((item) =>
        buildMembership({ path: item.path, permission: PermissionLevel.Admin }),
      );
      mockItemServiceGet(items);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetDescendants();
      mockItemServiceDelete(items);
      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.DELETE,
        url: `/items?${qs.stringify({ id: items.map(({ id }) => id) }, { arrayFormat: 'repeat' })}`,
      });

      expect(response.json()).toEqual(items);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Delete successfully one item', async () => {
      const items = [getDummyItem()];
      mockItemServiceGet(items);
      const memberships = items.map((item) =>
        buildMembership({ path: item.path, permission: PermissionLevel.Admin }),
      );
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetDescendants();
      mockItemServiceDelete(items);
      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.DELETE,
        url: `/items?${qs.stringify({ id: items.map(({ id }) => id) }, { arrayFormat: 'repeat' })}`,
      });

      expect(response.json()).toEqual(items);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Bad request if one id is invalid', async () => {
      const app = await build();
      const items = [getDummyItem(), getDummyItem(), { id: 'invalid-id' }];
      const response = await app.inject({
        method: HTTP_METHODS.DELETE,
        url: `/items?${qs.stringify({ id: items.map(({ id }) => id) }, { arrayFormat: 'repeat' })}`,
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });
    it('Delete all items but one missing item error', async () => {
      const id = uuidv4();
      const items = [getDummyItem(), getDummyItem()];
      const memberships = items.map((item) =>
        buildMembership({ path: item.path, permission: PermissionLevel.Admin }),
      );
      mockItemServiceGet(items);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetDescendants();
      mockItemServiceDelete(items);
      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.DELETE,
        url: `/items?${qs.stringify(
          { id: [...items.map(({ id }) => id), id] },
          { arrayFormat: 'repeat' },
        )}`,
      });

      expect(response.json()).toEqual([...items, new ItemNotFound(id)]);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
  });
  describe('POST /items/:id/move', () => {
    it('Move successfully', async () => {
      const item = getDummyItem();
      const targetItem = getDummyItem();
      const items = [item, targetItem];
      const memberships = items.map((item) =>
        buildMembership({ path: item.path, permission: PermissionLevel.Admin }),
      );
      mockItemServiceGet(items);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetNumberOfDescendants();
      const mockMove = mockItemServiceMove();
      mockItemServiceGetNumberOfLevelsToFarthestChild();
      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/${item.id}/move`,
        payload: {
          parentId: targetItem.id,
        },
      });

      expect(mockMove).toHaveBeenCalled();
      expect(response.statusCode).toBe(204);
      app.close();
    });
    it('Bad Request if moved item id is invalid', async () => {
      const app = await build();
      const item = 'invalid-id';
      const targetItem = getDummyItem();
      const response = await app.inject({
        method: 'POST',
        url: `/items/${item}/move`,
        payload: {
          parentId: targetItem.id,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(response.statusMessage).toBe(ReasonPhrases.BAD_REQUEST);
      app.close();
    });
    it('Bad Request if target item id is invalid', async () => {
      const item = getDummyItem();
      const targetItem = 'invalid-id';
      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/${item.id}/move`,
        payload: {
          parentId: targetItem,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(response.statusMessage).toBe(ReasonPhrases.BAD_REQUEST);
      app.close();
    });
    it('Cannot move if moved item does not exist', async () => {
      const item = uuidv4();
      const targetItem = getDummyItem();
      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/${item}/move`,
        payload: {
          parentId: targetItem.id,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(response.json()).toEqual(new ItemNotFound(item));
      app.close();
    });
    it('Cannot move if target item does not exist', async () => {
      const item = getDummyItem();
      const targetItem = uuidv4();
      const memberships = [buildMembership({ path: item.path, permission: PermissionLevel.Admin })];
      mockItemServiceGet([item]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/${item.id}/move`,
        payload: {
          parentId: targetItem,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(response.json()).toEqual(new ItemNotFound(targetItem));
      app.close();
    });
    it('Cannot move root item to root', async () => {
      const item = getDummyItem();
      const memberships = [buildMembership({ path: item.path, permission: PermissionLevel.Admin })];

      mockItemServiceGet([item]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetNumberOfDescendants();
      mockItemServiceGetNumberOfLevelsToFarthestChild();
      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/${item.id}/move`,
        payload: {},
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(response.json()).toEqual(new InvalidMoveTarget());
      app.close();
    });
    it('Cannot move if moved item has too many descendants', async () => {
      const item = getDummyItem();
      const targetItem = getDummyItem();
      const memberships = [
        buildMembership({ path: item.path, permission: PermissionLevel.Admin }),
        buildMembership({ path: targetItem.path, permission: PermissionLevel.Admin }),
      ];
      mockItemServiceGet([item, targetItem]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetNumberOfDescendants(async () => MAX_DESCENDANTS_FOR_MOVE + 1);
      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/${item.id}/move`,
        payload: {
          parentId: targetItem.id,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(response.json()).toEqual(new TooManyDescendants(item.id));
      app.close();
    });
    it('Cannot move parent in child', async () => {
      const item = getDummyItem();
      const child = getDummyItem({ parentPath: item.path });
      const memberships = [
        buildMembership({ path: item.path, permission: PermissionLevel.Admin }),
        buildMembership({ path: child.path, permission: PermissionLevel.Admin }),
      ];
      mockItemServiceGet([item, child]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetNumberOfDescendants();
      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/${item.id}/move`,
        payload: {
          parentId: child.id,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(response.json()).toEqual(new InvalidMoveTarget(child.id));
      app.close();
    });
    it('Cannot move if hierarchy is too deep', async () => {
      const item = getDummyItem();
      const targetItem = getDummyItem();
      const memberships = [item, targetItem].map((item) =>
        buildMembership({ permission: PermissionLevel.Admin, path: item.path }),
      );
      mockItemServiceGet([item, targetItem]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetNumberOfDescendants();
      mockItemServiceGetNumberOfLevelsToFarthestChild(async () => MAX_TREE_LEVELS);
      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/${item.id}/move`,
        payload: {
          parentId: targetItem.id,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(response.json()).toEqual(new HierarchyTooDeep());
      app.close();
    });
  });
  // move many items
  describe('POST /items/move', () => {
    it('Move successfully', async () => {
      const items = [getDummyItem(), getDummyItem()];
      const targetItem = getDummyItem();
      const allItems = [...items, targetItem];
      const memberships = allItems.map((item) =>
        buildMembership({ permission: PermissionLevel.Admin, path: item.path }),
      );

      mockItemServiceGet(allItems);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetNumberOfDescendants();
      const mockMove = mockItemServiceMove();
      mockItemServiceGetNumberOfLevelsToFarthestChild();

      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/move?${qs.stringify(
          { id: items.map(({ id }) => id) },
          { arrayFormat: 'repeat' },
        )}`,
        payload: {
          parentId: targetItem.id,
        },
      });

      expect(mockMove).toHaveBeenCalledTimes(items.length);
      expect(response.statusCode).toBe(200);
      app.close();
    });
    it('Bad request if one id is invalid', async () => {
      const app = await build();
      const items = [getDummyItem(), getDummyItem(), { id: 'invalid-id' }];
      const response = await app.inject({
        method: 'POST',
        url: `/items/move?${qs.stringify(
          { id: items.map(({ id }) => id) },
          { arrayFormat: 'repeat' },
        )}`,
        payload: {},
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });
    it('Move all items but one missing item error', async () => {
      const items = [getDummyItem(), getDummyItem()];
      const targetItem = getDummyItem();
      const allItems = [...items, targetItem];
      const memberships = allItems.map((item) =>
        buildMembership({ path: item.path, permission: PermissionLevel.Admin }),
      );
      const missingItemId = uuidv4();
      mockItemServiceGet(allItems);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetNumberOfDescendants();
      const mockMove = mockItemServiceMove();
      mockItemServiceGetNumberOfLevelsToFarthestChild();

      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/move?${qs.stringify(
          { id: [...items.map(({ id }) => id), missingItemId] },
          { arrayFormat: 'repeat' },
        )}`,
        payload: {
          parentId: targetItem.id,
        },
      });
      expect(mockMove).toHaveBeenCalledTimes(items.length);
      expect(response.statusCode).toBe(200);
      app.close();
    });
    it('Move lots of items', async () => {
      const items = LOTS_OF_ITEMS;
      const targetItem = getDummyItem();
      const allItems = [...items, targetItem];
      const memberships = allItems.map((item) =>
        buildMembership({ path: item.path, permission: PermissionLevel.Admin }),
      );
      mockItemServiceGet(allItems);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetNumberOfDescendants();
      const mockMove = mockItemServiceMove();
      mockItemServiceGetNumberOfLevelsToFarthestChild();

      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/move?${qs.stringify(
          { id: items.map(({ id }) => id) },
          { arrayFormat: 'repeat' },
        )}`,
        payload: {
          parentId: targetItem.id,
        },
      });

      // wait a bit for tasks to complete
      await new Promise((res) =>
        setTimeout(() => {
          expect(mockMove).toHaveBeenCalledTimes(items.length);
          expect(response.statusCode).toBe(202);
          app.close();
          res(true);
        }, MULTIPLE_ITEMS_LOADING_TIME),
      );
    });
  });
  describe('POST /items/:id/copy', () => {
    it('Copy successfully', async () => {
      const item = getDummyItem();
      const targetItem = getDummyItem();
      const items = [item, targetItem];
      const memberships = [item, targetItem].map((item) =>
        buildMembership({ path: item.path, permission: PermissionLevel.Admin }),
      );
      mockItemServiceGet(items);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetNumberOfDescendants();
      mockItemServiceCreate();
      mockItemServiceGetNumberOfLevelsToFarthestChild();
      mockItemMembershipServiceCreate();
      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/${item.id}/copy`,
        payload: {
          parentId: targetItem.id,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const newItem = response.json();
      expect(newItem.name).toEqual(item.name);
      expect(newItem.description).toEqual(item.description);
      expect(newItem.creator).toEqual(MEMBERS_FIXTURES.ACTOR.id);
      expect(newItem.path).toContain(buildPathFromId(targetItem.id));
      expect(newItem.type).toEqual(item.type);
      // copy adds the children order
      expect(newItem.extra.folder.childrenOrder).toEqual([]);
      app.close();
    });
    it('Copy successfully with correct order', async () => {
      const item = getDummyItem();
      const targetItem = getDummyItem();
      const children = [
        getDummyItem({ parentPath: item.path }),
        getDummyItem({ parentPath: item.path }),
        getDummyItem({ parentPath: item.path }),
      ];
      const childOfChildren = getDummyItem({ parentPath: children[0].path });
      item.extra.folder = { childrenOrder: [children[0].id, children[2].id] };
      children[0].extra.folder = { childrenOrder: [childOfChildren.id] };

      const items = [item, targetItem, ...children];
      const memberships = items.map((item) =>
        buildMembership({ path: item.path, permission: PermissionLevel.Admin }),
      );
      const descendants = [...children, childOfChildren];
      mockItemServiceGet(items);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetDescendants(async () => descendants);
      mockItemServiceGetNumberOfDescendants(async () => descendants.length);
      mockItemServiceCreate();
      mockItemServiceGetNumberOfLevelsToFarthestChild();
      mockItemMembershipServiceCreate();

      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/${item.id}/copy`,
        payload: {
          parentId: targetItem.id,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const newItem = response.json();
      expect(newItem.name).toEqual(item.name);
      expect(newItem.description).toEqual(item.description);
      expect(newItem.creator).toEqual(MEMBERS_FIXTURES.ACTOR.id);
      expect(newItem.path).toContain(buildPathFromId(targetItem.id));
      expect(newItem.type).toEqual(item.type);

      // check order is different and contains more children
      expect(newItem.extra.folder.childrenOrder.length).toEqual(children.length);
      expect(newItem.extra.folder.childrenOrder[0]).not.toEqual(item.extra.folder.childrenOrder[0]);
      app.close();
    });
    it('Bad Request if copied item id is invalid', async () => {
      const app = await build();
      const item = 'invalid-id';
      const targetItem = getDummyItem();
      const response = await app.inject({
        method: 'POST',
        url: `/items/${item}/copy`,
        payload: {
          parentId: targetItem.id,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(response.statusMessage).toBe(ReasonPhrases.BAD_REQUEST);
      app.close();
    });
    it('Bad Request if target item id is invalid', async () => {
      const item = getDummyItem();
      const targetItem = 'invalid-id';
      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/${item.id}/copy`,
        payload: {
          parentId: targetItem,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(response.statusMessage).toBe(ReasonPhrases.BAD_REQUEST);
      app.close();
    });
    it('Cannot copy if moved item does not exist', async () => {
      const item = uuidv4();
      const targetItem = getDummyItem();
      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/${item}/move`,
        payload: {
          parentId: targetItem.id,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(response.json()).toEqual(new ItemNotFound(item));
      app.close();
    });
    it('Cannot copy if target item does not exist', async () => {
      const item = getDummyItem();
      const targetItem = uuidv4();
      const memberships = [buildMembership({ path: item.path, permission: PermissionLevel.Admin })];
      mockItemServiceGet([item]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/${item.id}/copy`,
        payload: {
          parentId: targetItem,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(response.json()).toEqual(new ItemNotFound(targetItem));
      app.close();
    });
    it('Cannot copy if copied item has too many descendants', async () => {
      const item = getDummyItem();
      const targetItem = getDummyItem();
      const memberships = [
        buildMembership({ path: item.path, permission: PermissionLevel.Admin }),
        buildMembership({ path: targetItem.path, permission: PermissionLevel.Admin }),
      ];
      mockItemServiceGet([item, targetItem]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetNumberOfDescendants(async () => MAX_DESCENDANTS_FOR_COPY + 1);
      mockItemServiceCreate();
      mockItemServiceGetNumberOfLevelsToFarthestChild();

      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/${item.id}/copy`,
        payload: {
          parentId: targetItem.id,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(response.json()).toEqual(new TooManyDescendants(item.id));
      app.close();
    });
    it('Cannot copy if hierarchy is too deep', async () => {
      const item = getDummyItem();
      const targetItem = getDummyItem();
      const memberships = [
        buildMembership({ path: item.path, permission: PermissionLevel.Admin }),
        buildMembership({ path: targetItem.path, permission: PermissionLevel.Admin }),
      ];
      mockItemServiceGet([item, targetItem]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetNumberOfDescendants();
      mockItemServiceGetNumberOfLevelsToFarthestChild(async () => MAX_TREE_LEVELS);
      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/${item.id}/copy`,
        payload: {
          parentId: targetItem.id,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(response.json()).toEqual(new HierarchyTooDeep());
      app.close();
    });
  });
  // copy many items
  describe('POST /items/copy', () => {
    it('Copy successfully', async () => {
      const items = [getDummyItem(), getDummyItem()];
      const targetItem = getDummyItem();
      const allItems = [...items, targetItem];
      const memberships = allItems.map((item) =>
        buildMembership({ path: item.path, permission: PermissionLevel.Admin }),
      );
      mockItemServiceGet(allItems);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetNumberOfDescendants();
      mockItemServiceGetDescendants();
      mockItemServiceGetNumberOfLevelsToFarthestChild();
      const mockCreate = mockItemServiceCreate();
      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/copy?${qs.stringify(
          { id: items.map(({ id }) => id) },
          { arrayFormat: 'repeat' },
        )}`,
        payload: {
          parentId: targetItem.id,
        },
      });

      for (const { name } of items) {
        expect(response.json().map(({ name }) => name)).toContain(name);
      }
      expect(mockCreate).toHaveBeenCalledTimes(items.length);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Bad request if one id is invalid', async () => {
      const app = await build();
      const items = [getDummyItem(), getDummyItem(), { id: 'invalid-id' }];
      const response = await app.inject({
        method: 'POST',
        url: `/items/copy?${qs.stringify(
          { id: items.map(({ id }) => id) },
          { arrayFormat: 'repeat' },
        )}`,
        payload: {},
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });
    it('Copy all items but one missing item error', async () => {
      const missingItemId = uuidv4();
      const items = [getDummyItem(), getDummyItem()];
      const targetItem = getDummyItem();
      const allItems = [...items, targetItem];
      const memberships = allItems.map((item) =>
        buildMembership({ path: item.path, permission: PermissionLevel.Admin }),
      );
      mockItemServiceGet(allItems);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetNumberOfDescendants();
      mockItemServiceGetNumberOfLevelsToFarthestChild();
      const mockCreate = mockItemServiceCreate();
      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/copy?${qs.stringify(
          { id: [...items.map(({ id }) => id), missingItemId] },
          { arrayFormat: 'repeat' },
        )}`,
        payload: {
          parentId: targetItem.id,
        },
      });

      for (const { name } of items) {
        expect(response.json().map(({ name }) => name)).toContain(name);
      }
      expect(mockCreate).toHaveBeenCalledTimes(items.length);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Copy lots of items', async () => {
      const items = LOTS_OF_ITEMS;
      const targetItem = getDummyItem();
      const allItems = [...items, targetItem];
      const memberships = allItems.map((item) =>
        buildMembership({ path: item.path, permission: PermissionLevel.Admin }),
      );
      mockItemServiceGet(allItems);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetNumberOfDescendants();
      mockItemServiceGetNumberOfLevelsToFarthestChild();
      const mockCreate = mockItemServiceCreate();
      const app = await build();
      const response = await app.inject({
        method: 'POST',
        url: `/items/copy?${qs.stringify(
          { id: items.map(({ id }) => id) },
          { arrayFormat: 'repeat' },
        )}`,
        payload: {
          parentId: targetItem.id,
        },
      });
      // wait a bit for tasks to complete
      await new Promise((res) =>
        setTimeout(() => {
          expect(mockCreate).toHaveBeenCalledTimes(items.length);
          expect(response.statusCode).toBe(202);
          app.close();
          res(true);
        }, MULTIPLE_ITEMS_LOADING_TIME),
      );
    });
  });
});
