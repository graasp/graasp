import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { HttpMethod, PermissionLevel } from '@graasp/sdk';

import { clearDatabase } from '../../../../../../test/app';
import {
  saveItemAndMembership,
  saveMembership,
} from '../../../../itemMembership/test/fixtures/memberships';
import { ANNA, saveMember } from '../../../../member/test/fixtures/members';
import { TestWsClient } from '../../../../websockets/test/test-websocket-client';
import { setupWsApp } from '../../../../websockets/test/ws-app';
import { Item } from '../../../entities/Item';
import {
  ChildItemEvent,
  ItemEvent,
  OwnItemsEvent,
  SelfItemEvent,
  SharedItemsEvent,
  itemTopic,
  memberItemsTopic,
} from '../../../ws/events';
import { RecycledItemDataRepository } from '../repository';
import { RecycleBinEvent } from '../ws/events';

// mock datasource
jest.mock('../../../../../plugins/datasource');

/**
 * A custom serializier for items that ignores dates that may frequently change
 * To be used with toMatchObject
 */
function serialize(item: Item): Item {
  // Dates are not parsed by JSON so ensure that they are all strings
  const serialized = JSON.parse(JSON.stringify(item));
  // Ignore dates that may frequently change on the server
  delete serialized.deletedAt;
  delete serialized.updatedAt;
  return serialized;
}

describe('Recycle websocket hooks', () => {
  let app, actor, address;
  let ws: TestWsClient;

  beforeEach(async () => {
    ({ app, actor, address } = await setupWsApp());
    ws = new TestWsClient(address);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
    ws.close();
  });

  describe('on recycle', () => {
    it('receives deletion update when item is recycled', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const itemUpdates = await ws.subscribe<ItemEvent>({ topic: itemTopic, channel: item.id });

      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${item.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(() => {
        const [selfDelete] = itemUpdates;
        expect(selfDelete).toMatchObject(SelfItemEvent('delete', serialize(item)));
      });
    });

    it('item in the recycled subtree receives deletion update when top item is recycled', async () => {
      const { item: parentItem } = await saveItemAndMembership({ member: actor });
      const { item: childItem } = await saveItemAndMembership({ member: actor, parentItem });
      const itemUpdates = await ws.subscribe<ItemEvent>({
        topic: itemTopic,
        channel: childItem.id,
      });

      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${parentItem.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(() => {
        const [selfDelete] = itemUpdates;
        expect(selfDelete).toMatchObject(SelfItemEvent('delete', serialize(childItem)));
      });
    });

    it('parent item receives child deletion update when child item is recycled', async () => {
      const { item: parentItem } = await saveItemAndMembership({ member: actor });
      const { item: childItem } = await saveItemAndMembership({ parentItem, member: actor });
      const itemUpdates = await ws.subscribe<ItemEvent>({
        topic: itemTopic,
        channel: parentItem.id,
      });

      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${childItem.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(() => {
        const [childDelete] = itemUpdates;
        expect(childDelete).toMatchObject(ChildItemEvent('delete', serialize(childItem)));
      });
    });

    it('parent in the recycled subtree receives deletion update of child when top item is recycled', async () => {
      const { item: topItem } = await saveItemAndMembership({ member: actor });
      const { item: parentItem } = await saveItemAndMembership({
        member: actor,
        parentItem: topItem,
      });
      const { item: childItem } = await saveItemAndMembership({ parentItem, member: actor });
      const itemUpdates = await ws.subscribe<ItemEvent>({
        topic: itemTopic,
        channel: parentItem.id,
      });

      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${topItem.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(() => {
        const [selfDelete, childDelete] = itemUpdates;
        expect(selfDelete).toMatchObject(SelfItemEvent('delete', serialize(parentItem)));
        expect(childDelete).toMatchObject(ChildItemEvent('delete', serialize(childItem)));
      });
    });

    it('creator receives own items deletion update when item is recycled', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const memberItemsUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${item.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(() => {
        const [ownDelete] = memberItemsUpdates;
        expect(ownDelete).toMatchObject(OwnItemsEvent('delete', serialize(item)));
      });
    });

    it('members with memberships receive shared items delete update when item is recycled', async () => {
      const anna = await saveMember(ANNA);
      const { item } = await saveItemAndMembership({ member: anna });
      await saveMembership({ item, member: actor, permission: PermissionLevel.Read });
      const memberItemsUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      // send recycle request as admin Anna
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${item.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const [sharedDelete] = memberItemsUpdates;
        expect(sharedDelete).toMatchObject(SharedItemsEvent('delete', serialize(item)));
      });
    });

    it('members with memberships on item in the recycled subtree receive shared items delete update when top item is recycled', async () => {
      const anna = await saveMember(ANNA);
      const { item: parentItem } = await saveItemAndMembership({ member: anna });
      const { item: childItem } = await saveItemAndMembership({ member: anna, parentItem });
      await saveMembership({ item: childItem, member: actor, permission: PermissionLevel.Read });
      const memberItemsUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      // send recycle request as admin Anna
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${parentItem.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const [sharedDelete] = memberItemsUpdates;
        expect(sharedDelete).toMatchObject(SharedItemsEvent('delete', serialize(childItem)));
      });
    });

    it('members with multiple memberships on related items in the recycled subtree receive shared items delete update on topmost shared item only when top item is recycled', async () => {
      const anna = await saveMember(ANNA);
      const { item: topItem } = await saveItemAndMembership({ member: anna });
      const { item: parentItem } = await saveItemAndMembership({
        member: anna,
        parentItem: topItem,
      });
      const { item: childItem } = await saveItemAndMembership({ member: anna, parentItem });
      await saveMembership({ item: parentItem, member: actor, permission: PermissionLevel.Read });
      await saveMembership({ item: childItem, member: actor, permission: PermissionLevel.Admin });

      const memberItemsUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      // send recycle request as admin Anna
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${topItem.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const [sharedDelete] = memberItemsUpdates;
        expect(sharedDelete).toMatchObject(SharedItemsEvent('delete', serialize(parentItem)));
      });
    });

    it('admins receive recycle bin create update when item is recycled', async () => {
      const anna = await saveMember(ANNA);
      const { item } = await saveItemAndMembership({ member: anna });
      await saveMembership({ item, member: actor, permission: PermissionLevel.Admin });
      const memberItemsUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${item.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const [recycleCreate, sharedDelete] = memberItemsUpdates;
        expect(recycleCreate).toMatchObject(RecycleBinEvent('create', serialize(item)));
        expect(sharedDelete).toMatchObject(SharedItemsEvent('delete', serialize(item)));
      });
    });
  });

  describe('on restore', () => {
    it('parent item receives creation update when item is restored', async () => {
      const { item: parentItem } = await saveItemAndMembership({ member: actor });
      const { item: childItem } = await saveItemAndMembership({ member: actor, parentItem });

      const recycle = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${childItem.id}`,
      });
      expect(recycle.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });

      const itemUpdates = await ws.subscribe<ItemEvent>({
        topic: itemTopic,
        channel: parentItem.id,
      });

      const restore = await app.inject({
        method: HttpMethod.POST,
        url: `/items/restore?id=${childItem.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const [childCreate] = itemUpdates;
        expect(childCreate).toMatchObject(ChildItemEvent('create', serialize(childItem)));
      });
    });

    it('creator receives own items creation update when item is restored', async () => {
      const { item } = await saveItemAndMembership({ member: actor });

      const recycle = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${item.id}`,
      });
      expect(recycle.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });

      const itemUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      const restore = await app.inject({
        method: HttpMethod.POST,
        url: `/items/restore?id=${item.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const [ownCreate] = itemUpdates;
        expect(ownCreate).toMatchObject(OwnItemsEvent('create', serialize(item)));
      });
    });

    it('members with memberships receive shared items create update when item is restored', async () => {
      const anna = await saveMember(ANNA);
      const { item } = await saveItemAndMembership({ member: anna });
      await saveMembership({ member: actor, item, permission: PermissionLevel.Read });

      // send recycle request as admin Anna
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${item.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });

      // send subscription as user
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = actor;
      });
      const memberItemsUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      // send restore request as admin Anna
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const restore = await app.inject({
        method: HttpMethod.POST,
        url: `/items/restore?id=${item.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const [sharedCreate] = memberItemsUpdates;
        expect(sharedCreate).toMatchObject(SharedItemsEvent('create', serialize(item)));
      });
    });

    it('members with memberships on item in the recycled subtree receive shared items create update when top item is restored', async () => {
      const anna = await saveMember(ANNA);
      const { item: parentItem } = await saveItemAndMembership({ member: anna });
      const { item: childItem } = await saveItemAndMembership({ member: anna, parentItem });
      await saveMembership({ member: actor, item: childItem, permission: PermissionLevel.Read });

      // send recycle request as admin Anna
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${parentItem.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });

      // send subscription as user
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = actor;
      });
      const memberItemsUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      // send restore request as admin Anna
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const restore = await app.inject({
        method: HttpMethod.POST,
        url: `/items/restore?id=${parentItem.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const [sharedCreate] = memberItemsUpdates;
        expect(sharedCreate).toMatchObject(SharedItemsEvent('create', serialize(childItem)));
      });
    });

    it('members with multiple memberships on related items in the recycled subtree receive shared items create update on topmost shared item only when top item is recycled', async () => {
      const anna = await saveMember(ANNA);
      const { item: topItem } = await saveItemAndMembership({ member: anna });
      const { item: parentItem } = await saveItemAndMembership({
        member: anna,
        parentItem: topItem,
      });
      const { item: childItem } = await saveItemAndMembership({ member: anna, parentItem });
      await saveMembership({ member: actor, item: parentItem, permission: PermissionLevel.Read });
      await saveMembership({ member: actor, item: childItem, permission: PermissionLevel.Admin });

      // send recycle request as admin Anna
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${parentItem.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });

      // send subscription as user
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = actor;
      });
      const memberItemsUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      // send restore request as admin Anna
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const restore = await app.inject({
        method: HttpMethod.POST,
        url: `/items/restore?id=${parentItem.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const [sharedCreate] = memberItemsUpdates;
        expect(sharedCreate).toMatchObject(SharedItemsEvent('create', serialize(parentItem)));
      });
    });

    it('admins receive recycle bin delete update when item is recycled', async () => {
      const anna = await saveMember(ANNA);
      const { item } = await saveItemAndMembership({ member: anna });
      await saveMembership({ item, member: actor, permission: PermissionLevel.Admin });

      // send recycle request as admin Anna
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const recycle = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${item.id}`,
      });
      expect(recycle.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });

      // send subscription as user
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = actor;
      });
      const memberItemsUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      const restore = await app.inject({
        method: HttpMethod.POST,
        url: `/items/restore?id=${item.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const [recycleDelete, sharedCreate] = memberItemsUpdates;
        expect(recycleDelete).toMatchObject(RecycleBinEvent('delete', serialize(item)));
        expect(sharedCreate).toMatchObject(SharedItemsEvent('create', serialize(item)));
      });
    });
  });
});
