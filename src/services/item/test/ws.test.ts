import { StatusCodes } from 'http-status-codes';
import { Not } from 'typeorm';
import waitForExpect from 'wait-for-expect';

import { HttpMethod, Websocket, parseStringToDate } from '@graasp/sdk';

import { clearDatabase } from '../../../../test/app';
import { MemberCannotAccess } from '../../../utils/errors';
import { saveMember } from '../../member/test/fixtures/members';
import { TestWsClient } from '../../websockets/test/test-websocket-client';
import { setupWsApp } from '../../websockets/test/ws-app';
import { FolderItem, Item } from '../entities/Item';
import { ItemRepository } from '../repository';
import {
  AccessibleItemsEvent,
  ChildItemEvent,
  ItemEvent,
  ItemOpFeedbackEvent,
  OwnItemsEvent,
  itemTopic,
  memberItemsTopic,
} from '../ws/events';
import { ItemTestUtils, expectItem } from './fixtures/items';

// mock datasource
jest.mock('../../../plugins/datasource');
const testUtils = new ItemTestUtils();

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
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
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
      const anna = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member: anna });
      await testUtils.saveMembership({ item, member: actor });
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
      const anna = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member: anna });
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

  describe('on copy item', () => {
    it('parent item receives child create update', async () => {
      const { item: item1 } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: item2 } = await testUtils.saveItemAndMembership({ member: actor });

      const itemUpdates = await ws.subscribe({ topic: itemTopic, channel: item1.id });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/copy?id=${item2.id}`,
        payload: { parentId: item1.id },
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await testUtils.rawItemRepository.count()).toBeGreaterThan(2);
      });

      const copy = (await testUtils.itemRepository.getDescendants(item1 as FolderItem))[0];

      await waitForExpect(() => {
        const [childCreate] = itemUpdates;
        expect(childCreate).toMatchObject(
          ChildItemEvent('create', parseStringToDate(copy) as Item),
        );
      });
    });

    it('creator receives own items create update when destination is root', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });

      const itemUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/copy?id=${item.id}`,
        payload: {},
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await testUtils.rawItemRepository.count()).toBeGreaterThan(1);
      });

      const copy = await testUtils.rawItemRepository.findOne({ where: { id: Not(item.id) } });

      await waitForExpect(() => {
        const [childCreate, accessibleCreate] = itemUpdates;
        expect(childCreate).toMatchObject(OwnItemsEvent('create', parseStringToDate(copy) as Item));
        expect(accessibleCreate).toMatchObject(
          AccessibleItemsEvent('create', parseStringToDate(copy) as Item),
        );
      });
    });
  });

  describe('on move item', () => {
    it('parent of old location receives child deletion update', async () => {
      const { item: oldParentItem } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: newParentItem } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: childItem } = await testUtils.saveItemAndMembership({
        member: actor,
        parentItem: oldParentItem,
      });

      const itemUpdates = await ws.subscribe({ topic: itemTopic, channel: oldParentItem.id });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/move?id=${childItem.id}`,
        payload: { parentId: newParentItem.id },
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect((await testUtils.rawItemRepository.findOneBy({ id: childItem.id }))?.path).toContain(
          newParentItem.path,
        );
      });

      await waitForExpect(() => {
        const [childDelete] = itemUpdates;
        expect(childDelete).toMatchObject(
          ChildItemEvent('delete', parseStringToDate(childItem) as Item),
        );
      });
    });

    it('parent of new location receives child creation update', async () => {
      const { item: oldParentItem } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: newParentItem } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: childItem } = await testUtils.saveItemAndMembership({
        member: actor,
        parentItem: oldParentItem,
      });

      const itemUpdates = await ws.subscribe({ topic: itemTopic, channel: newParentItem.id });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/move?id=${childItem.id}`,
        payload: { parentId: newParentItem.id },
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect((await testUtils.rawItemRepository.findOneBy({ id: childItem.id }))?.path).toContain(
          newParentItem.path,
        );
      });

      const moved = await testUtils.rawItemRepository.findOneBy({ id: childItem.id });

      await waitForExpect(() => {
        const [childCreate] = itemUpdates;
        expect(childCreate).toMatchObject(
          ChildItemEvent('create', parseStringToDate(moved) as Item),
        );
      });
    });

    it('creator receives own items delete update if old location was root of creator', async () => {
      const { item: newParentItem } = await testUtils.saveItemAndMembership({ member: actor });
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
      });

      const itemUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/move?id=${item.id}`,
        payload: { parentId: newParentItem.id },
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect((await testUtils.rawItemRepository.findOneBy({ id: item.id }))?.path).toContain(
          newParentItem.path,
        );
      });

      await waitForExpect(() => {
        const [ownDelete, accessibleDelete] = itemUpdates;
        expect(ownDelete).toMatchObject(OwnItemsEvent('delete', parseStringToDate(item) as Item));
        expect(accessibleDelete).toMatchObject(
          AccessibleItemsEvent('delete', parseStringToDate(item) as Item),
        );
      });
    });

    it('creator receives own items create update if new location is root of creator', async () => {
      const { item: oldParentItem } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: childItem } = await testUtils.saveItemAndMembership({
        member: actor,
        parentItem: oldParentItem,
      });

      const itemUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/move?id=${childItem.id}`,
        payload: {},
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(
          (await testUtils.rawItemRepository.findOneBy({ id: childItem.id }))?.path,
        ).not.toContain(oldParentItem.path);
      });

      const moved = await testUtils.rawItemRepository.findOneBy({ id: childItem.id });

      await waitForExpect(() => {
        const [ownCreate] = itemUpdates;
        expect(ownCreate).toMatchObject(OwnItemsEvent('create', parseStringToDate(moved) as Item));
      });
    });
  });

  describe('asynchronous feedback', () => {
    it('member that initiated the updateMany operation receives success feedback', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      const payload = { name: 'new name' };
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/?id=${item.id}`,
        payload,
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      let updated;
      await waitForExpect(async () => {
        updated = await testUtils.rawItemRepository.findOneBy(payload);
        expect(updated).not.toBe(null);
      });

      expectItem(updated, { ...item, ...payload }, actor);

      let feedbackUpdate;
      // this ffedback seems flacky, this might be because the websocket is sent from inside the transaction ?
      await waitForExpect(() => {
        feedbackUpdate = memberUpdates.find((update) => update.kind === 'feedback');
        expect(feedbackUpdate).toBeDefined();
      }, 8000);

      expect(feedbackUpdate).toMatchObject(
        ItemOpFeedbackEvent('update', [item.id], { data: { [item.id]: updated }, errors: [] }),
      );
    });

    it('member that initiated the updateMany operation receives failure feedback', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      jest.spyOn(ItemRepository.prototype, 'patch').mockImplementation(() => {
        throw new Error('mock error');
      });

      const payload = { name: 'new name' };
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/?id=${item.id}`,
        payload,
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(() => {
        const [feedbackUpdate] = memberUpdates;
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackEvent('update', [item.id], { error: new Error('mock error') }),
        );
      });
    });

    it('member that initiated the deleteMany operation receives success feedback', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/items/?id=${item.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await testUtils.rawItemRepository.findOneBy({ id: item.id })).toBe(null);
      });

      await waitForExpect(() => {
        const [_ownUpdate, _accessibleUpdate, feedbackUpdate] = memberUpdates;
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackEvent('delete', [item.id], { data: { [item.id]: item }, errors: [] }),
        );
      });
    });

    it('member that initiated the deleteMany operation receives failure feedback', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      jest.spyOn(ItemRepository.prototype, 'deleteMany').mockImplementation(() => {
        throw new Error('mock error');
      });

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/items/?id=${item.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(() => {
        const [_ownUpdate, _accessibleUpdate, feedbackUpdate] = memberUpdates;
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackEvent('delete', [item.id], { error: new Error('mock error') }),
        );
      });
    });

    it('member that initiated the move operation receives success feedback', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: newParent } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/move?id=${item.id}`,
        payload: { parentId: newParent.id },
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      let moved;
      await waitForExpect(async () => {
        moved = await testUtils.rawItemRepository.findOneBy({ id: item.id });
        expect(moved?.path).toContain(newParent.path);
      });

      await waitForExpect(() => {
        expect(memberUpdates.find((v) => v.kind === 'feedback')).toMatchObject(
          ItemOpFeedbackEvent('move', [item.id], { data: { [item.id]: moved }, errors: [] }),
        );
      });
    });

    it('member that initiated the move operation receives failure feedback', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: newParent } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      jest.spyOn(ItemRepository.prototype, 'move').mockImplementation(async () => {
        throw new Error('mock error');
      });

      const response = await app.inject({
        method: HttpMethod.Post,
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
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: newParent } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/copy?id=${item.id}`,
        payload: { parentId: newParent.id },
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      let copied;
      await waitForExpect(async () => {
        [copied] = await testUtils.itemRepository.getDescendants(newParent as FolderItem);
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
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: newParent } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      jest.spyOn(ItemRepository.prototype, 'copy').mockImplementation(async () => {
        throw new Error('mock error');
      });

      const response = await app.inject({
        method: HttpMethod.Post,
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
