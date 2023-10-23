import { StatusCodes } from 'http-status-codes';
import { Not } from 'typeorm';
import waitForExpect from 'wait-for-expect';

import { HttpMethod, PermissionLevel, Websocket, parseStringToDate } from '@graasp/sdk';

import { clearDatabase } from '../../../../test/app';
import { MemberCannotAccess } from '../../../utils/errors';
import {
  saveItemAndMembership,
  saveMembership,
} from '../../itemMembership/test/fixtures/memberships';
import { ANNA, saveMember } from '../../member/test/fixtures/members';
import { TestWsClient } from '../../websockets/test/test-websocket-client';
import { setupWsApp } from '../../websockets/test/ws-app';
import { ItemRepository } from '../repository';
import {
  ChildItemEvent,
  ItemOpFeedbackEvent,
  OwnItemsEvent,
  SelfItemEvent,
  SharedItemsEvent,
  itemTopic,
  memberItemsTopic,
} from '../ws/events';
import { expectItem, getDummyItem } from './fixtures/items';

// mock datasource
jest.mock('../../../plugins/datasource');

describe('Item websocket hooks', () => {
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

  describe('Subscribe to item', () => {
    it('subscribes to own item successfully', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const request = {
        realm: Websocket.Realms.Notif,
        topic: itemTopic,
        channel: item.id,
        action: Websocket.ClientActions.Subscribe,
      };

      const res = await ws.send(request);
      expect(res).toEqual({
        realm: Websocket.Realms.Notif,
        type: Websocket.ServerMessageTypes.Response,
        status: Websocket.ResponseStatuses.Success,
        request: request,
      });
    });

    it('subscribes to item with membership successfully', async () => {
      const anna = await saveMember(ANNA);
      const { item } = await saveItemAndMembership({ member: anna });
      await saveMembership({ item, member: actor });
      const request = {
        realm: Websocket.Realms.Notif,
        topic: itemTopic,
        channel: item.id,
        action: Websocket.ClientActions.Subscribe,
      };

      const res = await ws.send(request);
      expect(res).toEqual({
        realm: Websocket.Realms.Notif,
        type: Websocket.ServerMessageTypes.Response,
        status: Websocket.ResponseStatuses.Success,
        request: request,
      });
    });

    it('cannot subscribe to item with no membership', async () => {
      const anna = await saveMember(ANNA);
      const { item } = await saveItemAndMembership({ member: anna });
      const request = {
        realm: Websocket.Realms.Notif,
        topic: itemTopic,
        channel: item.id,
        action: Websocket.ClientActions.Subscribe,
      };

      const res = await ws.send(request);
      expect(res).toEqual({
        realm: Websocket.Realms.Notif,
        type: Websocket.ServerMessageTypes.Response,
        status: Websocket.ResponseStatuses.Error,
        request: request,
        error: new MemberCannotAccess(item.id),
      });
    });
  });

  describe('on create item', () => {
    it('parent item receives child item create update', async () => {
      const { item: parent } = await saveItemAndMembership({ member: actor });

      const itemUpdates = await ws.subscribe({ topic: itemTopic, channel: parent.id });

      const child = getDummyItem();
      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/items?parentId=${parent.id}`,
        payload: child,
      });
      const res = response.json();
      expect(response.statusCode).toBe(StatusCodes.OK);
      expectItem(res, child, actor, parent);

      await waitForExpect(() => {
        const [childCreate] = itemUpdates;
        expect(childCreate).toMatchObject(ChildItemEvent('create', parseStringToDate(res)));
      });
    });

    it('creator receives own item create update', async () => {
      const itemUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      const item = getDummyItem();
      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/items`,
        payload: item,
      });
      const res = response.json();
      expect(response.statusCode).toBe(StatusCodes.OK);
      expectItem(res, item, actor);

      await waitForExpect(() => {
        const [childCreate] = itemUpdates;
        expect(childCreate).toMatchObject(OwnItemsEvent('create', parseStringToDate(res)));
      });
    });
  });

  describe('on update item', () => {
    it('receives update on item itself', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const itemUpdates = await ws.subscribe({ topic: itemTopic, channel: item.id });

      const payload = { name: 'new name' };
      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/items/${item.id}`,
        payload: { name: 'new name' },
      });
      const res = response.json();
      expect(response.statusCode).toBe(StatusCodes.OK);
      expectItem(res, { ...item, ...payload }, actor);

      await waitForExpect(() => {
        const [selfUpdate] = itemUpdates;
        expect(selfUpdate).toMatchObject(SelfItemEvent('update', parseStringToDate(res)));
      });
    });

    it('parent receives child item update', async () => {
      const { item: parentItem } = await saveItemAndMembership({ member: actor });
      const { item: childItem } = await saveItemAndMembership({ member: actor, parentItem });

      const itemUpdates = await ws.subscribe({ topic: itemTopic, channel: parentItem.id });

      const payload = { name: 'new name' };
      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/items/${childItem.id}`,
        payload: { name: 'new name' },
      });
      const res = response.json();
      expect(response.statusCode).toBe(StatusCodes.OK);
      expectItem(res, { ...childItem, ...payload }, actor);

      await waitForExpect(() => {
        const [childUpdate] = itemUpdates;
        expect(childUpdate).toMatchObject(ChildItemEvent('update', parseStringToDate(res)));
      });
    });

    it('creator receives own items update', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const itemUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      const payload = { name: 'new name' };
      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/items/${item.id}`,
        payload: { name: 'new name' },
      });
      const res = response.json();
      expect(response.statusCode).toBe(StatusCodes.OK);
      expectItem(res, { ...item, ...payload }, actor);

      await waitForExpect(() => {
        const [ownUpdate] = itemUpdates;
        expect(ownUpdate).toMatchObject(OwnItemsEvent('update', parseStringToDate(res)));
      });
    });

    it('member with membership on item receives shared items update', async () => {
      const anna = await saveMember(ANNA);
      const { item } = await saveItemAndMembership({ member: anna });
      await saveMembership({ item, member: actor, permission: PermissionLevel.Read });
      const itemUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      // send recycle request as admin Anna
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const payload = { name: 'new name' };
      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/items/${item.id}`,
        payload: { name: 'new name' },
      });
      const res = response.json();
      expect(response.statusCode).toBe(StatusCodes.OK);
      expectItem(res, { ...item, ...payload }, anna);

      await waitForExpect(() => {
        const [sharedUpdate] = itemUpdates;
        expect(sharedUpdate).toMatchObject(SharedItemsEvent('update', parseStringToDate(res)));
      });
    });
  });

  describe('on delete item', () => {
    it('receives deletion update on item itself', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const itemUpdates = await ws.subscribe({ topic: itemTopic, channel: item.id });

      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/items?id=${item.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await ItemRepository.findOneBy({ id: item.id })).toEqual(null);
      });

      await waitForExpect(() => {
        const [selfDelete] = itemUpdates;
        expect(selfDelete).toMatchObject(SelfItemEvent('delete', parseStringToDate(item)));
      });
    });

    it('parent receives child deletion update', async () => {
      const { item: parentItem } = await saveItemAndMembership({ member: actor });
      const { item: childItem } = await saveItemAndMembership({ member: actor, parentItem });

      const itemUpdates = await ws.subscribe({ topic: itemTopic, channel: parentItem.id });

      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/items?id=${childItem.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await ItemRepository.findOneBy({ id: childItem.id })).toEqual(null);
      });

      await waitForExpect(() => {
        const [childDelete] = itemUpdates;
        expect(childDelete).toMatchObject(ChildItemEvent('delete', parseStringToDate(childItem)));
      });
    });

    it('creator receives own items delete update', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const itemUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/items?id=${item.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await ItemRepository.findOneBy({ id: item.id })).toEqual(null);
      });

      await waitForExpect(() => {
        const [ownDelete] = itemUpdates;
        expect(ownDelete).toMatchObject(OwnItemsEvent('delete', parseStringToDate(item)));
      });
    });

    it('member with membership on item receives shared items delete update', async () => {
      const anna = await saveMember(ANNA);
      const { item } = await saveItemAndMembership({ member: anna });
      await saveMembership({ item, member: actor, permission: PermissionLevel.Read });
      const itemUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      // send recycle request as admin Anna
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/items?id=${item.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await ItemRepository.findOneBy({ id: item.id })).toEqual(null);
      });

      await waitForExpect(() => {
        const [sharedDelete] = itemUpdates;
        expect(sharedDelete).toMatchObject(SharedItemsEvent('delete', parseStringToDate(item)));
      });
    });
  });

  describe('on copy item', () => {
    it('parent item receives child create update', async () => {
      const { item: item1 } = await saveItemAndMembership({ member: actor });
      const { item: item2 } = await saveItemAndMembership({ member: actor });

      const itemUpdates = await ws.subscribe({ topic: itemTopic, channel: item1.id });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/items/copy?id=${item2.id}`,
        payload: { parentId: item1.id },
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await ItemRepository.count()).toBeGreaterThan(2);
      });

      const copy = (await ItemRepository.getDescendants(item1))[0];

      await waitForExpect(() => {
        const [childCreate] = itemUpdates;
        expect(childCreate).toMatchObject(ChildItemEvent('create', parseStringToDate(copy)));
      });
    });

    it('creator receives own items create update when destination is root', async () => {
      const { item } = await saveItemAndMembership({ member: actor });

      const itemUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/items/copy?id=${item.id}`,
        payload: {},
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await ItemRepository.count()).toBeGreaterThan(1);
      });

      const copy = await ItemRepository.findOne({ where: { id: Not(item.id) } });

      await waitForExpect(() => {
        const [childCreate] = itemUpdates;
        expect(childCreate).toMatchObject(OwnItemsEvent('create', parseStringToDate(copy)));
      });
    });
  });

  describe('on move item', () => {
    it('parent of old location receives child deletion update', async () => {
      const { item: oldParentItem } = await saveItemAndMembership({ member: actor });
      const { item: newParentItem } = await saveItemAndMembership({ member: actor });
      const { item: childItem } = await saveItemAndMembership({
        member: actor,
        parentItem: oldParentItem,
      });

      const itemUpdates = await ws.subscribe({ topic: itemTopic, channel: oldParentItem.id });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/items/move?id=${childItem.id}`,
        payload: { parentId: newParentItem.id },
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect((await ItemRepository.findOneBy({ id: childItem.id }))?.path).toContain(
          newParentItem.path,
        );
      });

      await waitForExpect(() => {
        const [childDelete] = itemUpdates;
        expect(childDelete).toMatchObject(ChildItemEvent('delete', parseStringToDate(childItem)));
      });
    });

    it('parent of new location receives child creation update', async () => {
      const { item: oldParentItem } = await saveItemAndMembership({ member: actor });
      const { item: newParentItem } = await saveItemAndMembership({ member: actor });
      const { item: childItem } = await saveItemAndMembership({
        member: actor,
        parentItem: oldParentItem,
      });

      const itemUpdates = await ws.subscribe({ topic: itemTopic, channel: newParentItem.id });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/items/move?id=${childItem.id}`,
        payload: { parentId: newParentItem.id },
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect((await ItemRepository.findOneBy({ id: childItem.id }))?.path).toContain(
          newParentItem.path,
        );
      });

      const moved = await ItemRepository.findOneBy({ id: childItem.id });

      await waitForExpect(() => {
        const [childCreate] = itemUpdates;
        expect(childCreate).toMatchObject(ChildItemEvent('create', parseStringToDate(moved)));
      });
    });

    it('creator receives own items delete update if old location was root of creator', async () => {
      const { item: newParentItem } = await saveItemAndMembership({ member: actor });
      const { item } = await saveItemAndMembership({
        member: actor,
      });

      const itemUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/items/move?id=${item.id}`,
        payload: { parentId: newParentItem.id },
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect((await ItemRepository.findOneBy({ id: item.id }))?.path).toContain(
          newParentItem.path,
        );
      });

      await waitForExpect(() => {
        const [ownDelete] = itemUpdates;
        expect(ownDelete).toMatchObject(OwnItemsEvent('delete', parseStringToDate(item)));
      });
    });

    it('creator receives own items create update if new location is root of creator', async () => {
      const { item: oldParentItem } = await saveItemAndMembership({ member: actor });
      const { item: childItem } = await saveItemAndMembership({
        member: actor,
        parentItem: oldParentItem,
      });

      const itemUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/items/move?id=${childItem.id}`,
        payload: {},
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect((await ItemRepository.findOneBy({ id: childItem.id }))?.path).not.toContain(
          oldParentItem.path,
        );
      });

      const moved = await ItemRepository.findOneBy({ id: childItem.id });

      await waitForExpect(() => {
        const [ownCreate] = itemUpdates;
        expect(ownCreate).toMatchObject(OwnItemsEvent('create', parseStringToDate(moved)));
      });
    });
  });

  describe('asynchronous feedback', () => {
    it('member that initiated the updateMany operation receives success feedback', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      const payload = { name: 'new name' };
      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/items/?id=${item.id}`,
        payload,
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      let updated;
      await waitForExpect(async () => {
        updated = await ItemRepository.findOneBy(payload);
        expect(updated).not.toBe(null);
      });

      expectItem(updated, { ...item, ...payload }, actor);

      await waitForExpect(() => {
        const [ownUpdate, feedbackUpdate] = memberUpdates;
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackEvent('update', [item.id], { data: { [item.id]: updated }, errors: [] }),
        );
      });
    });

    it('member that initiated the updateMany operation receives failure feedback', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      jest.spyOn(ItemRepository, 'patch').mockImplementation(() => {
        throw new Error('mock error');
      });

      const payload = { name: 'new name' };
      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/items/?id=${item.id}`,
        payload,
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(() => {
        const [feedbackUpdate] = memberUpdates;
        console.log(JSON.stringify(feedbackUpdate));
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackEvent('update', [item.id], { error: new Error('mock error') }),
        );
      });
    });

    it('member that initiated the deleteMany operation receives success feedback', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/items/?id=${item.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await ItemRepository.findOneBy({ id: item.id })).toBe(null);
      });

      await waitForExpect(() => {
        const [ownUpdate, feedbackUpdate] = memberUpdates;
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackEvent('delete', [item.id], { data: { [item.id]: item }, errors: [] }),
        );
      });
    });

    it('member that initiated the deleteMany operation receives failure feedback', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      jest.spyOn(ItemRepository, 'deleteMany').mockImplementation(() => {
        throw new Error('mock error');
      });

      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/items/?id=${item.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(() => {
        const [ownUpdate, feedbackUpdate] = memberUpdates;
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackEvent('delete', [item.id], { error: new Error('mock error') }),
        );
      });
    });

    it('member that initiated the move operation receives success feedback', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const { item: newParent } = await saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/items/move?id=${item.id}`,
        payload: { parentId: newParent.id },
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      let moved;
      await waitForExpect(async () => {
        moved = await ItemRepository.findOneBy({ id: item.id });
        expect(moved?.path).toContain(newParent.path);
      });

      await waitForExpect(() => {
        const [ownUpdate, feedbackUpdate] = memberUpdates;
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackEvent('move', [item.id], { data: { [item.id]: moved }, errors: [] }),
        );
      });
    });

    it('member that initiated the move operation receives failure feedback', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const { item: newParent } = await saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      jest.spyOn(ItemRepository, 'move').mockImplementation(async () => {
        throw new Error('mock error');
      });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/items/move?id=${item.id}`,
        payload: { parentId: newParent.id },
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(() => {
        const [feedbackUpdate] = memberUpdates;
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackEvent('move', [item.id], { error: new Error('mock error') }),
        );
      });
    });

    it('member that initiated the copy operation receives success feedback', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const { item: newParent } = await saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/items/copy?id=${item.id}`,
        payload: { parentId: newParent.id },
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      let copied;
      await waitForExpect(async () => {
        [copied] = await ItemRepository.getDescendants(newParent);
        expect(copied).toBeDefined();
      });

      await waitForExpect(() => {
        const [feedbackUpdate] = memberUpdates;
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackEvent('copy', [item.id], { data: { [copied.id]: copied }, errors: [] }),
        );
      });
    });

    it('member that initiated the copy operation receives failure feedback', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const { item: newParent } = await saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      jest.spyOn(ItemRepository, 'copy').mockImplementation(async () => {
        throw new Error('mock error');
      });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/items/copy?id=${item.id}`,
        payload: { parentId: newParent.id },
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(() => {
        const [feedbackUpdate] = memberUpdates;
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackEvent('copy', [item.id], { error: new Error('mock error') }),
        );
      });
    });
  });
});
